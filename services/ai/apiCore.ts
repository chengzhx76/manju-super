/**
 * AI API core utilities:
 * - API key lookup and routing
 * - retry and timeout helpers
 * - chat completion (sync / stream)
 * - media conversion helpers
 */

import { AspectRatio } from '../../types'
import {
  getGlobalApiKey as getRegistryApiKey,
  setGlobalApiKey as setRegistryApiKey,
  getApiBaseUrlForModel,
  getApiKeyForModel,
  getProviderById,
  getModelById,
  getModels,
  getActiveModel,
  getActiveChatModel,
  getActiveVideoModel,
  getActiveImageModel,
  getActiveAudioModel
} from '../modelRegistry'
import { fetchMediaWithCorsFallback } from '../mediaFetchService'
import {
  DEFAULT_CHAT_VERIFY_MODEL,
  normalizeChatModelId
} from '../modelIdUtils'

// ============================================
// Script progress callback
// ============================================

type ScriptLogCallback = (message: string) => void

let scriptLogCallback: ScriptLogCallback | null = null

export const setScriptLogCallback = (callback: ScriptLogCallback) => {
  scriptLogCallback = callback
}

export const clearScriptLogCallback = () => {
  scriptLogCallback = null
}

export const logScriptProgress = (message: string) => {
  if (scriptLogCallback) {
    scriptLogCallback(message)
  }
}

// ============================================
// API key management
// ============================================

/** API key error */
export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiKeyError'
  }
}

/** Runtime fallback API key (backward compatibility). */
let runtimeApiKey: string = process.env.API_KEY || ''

/** Set global API key for runtime + model registry */
export const setGlobalApiKey = (key: string) => {
  runtimeApiKey = key
  setRegistryApiKey(key)
}

/** Default API base URL fallback */
const DEFAULT_API_BASE = 'https://api.antsk.cn'

/** Resolve model by type and optional modelId */
export const resolveModel = (
  type: 'chat' | 'image' | 'video' | 'audio',
  modelId?: string
) => {
  if (modelId) {
    const normalizedModelId = modelId.toLowerCase()
    const compatModelId =
      type === 'chat' ? normalizeChatModelId(modelId) || modelId : modelId
    // Keep alias compatibility for model registry lookup.
    const lookupId =
      normalizedModelId === 'veo_3_1-fast-4k' ? 'veo_3_1-fast' : compatModelId
    const model = getModelById(lookupId)
    if (model && model.type === type) return model

    const candidates = getModels(type).filter((m) => m.apiModel === lookupId)
    if (candidates.length === 1) return candidates[0]
  }

  return getActiveModel(type)
}

/** Resolve model name used in request body */
export const resolveRequestModel = (
  type: 'chat' | 'image' | 'video' | 'audio',
  modelId?: string
): string => {
  // Preserve explicit 4k request model naming.
  if (modelId && modelId.toLowerCase() === 'veo_3_1-fast-4k') {
    return modelId
  }

  const compatModelId =
    type === 'chat' ? normalizeChatModelId(modelId) : modelId
  const resolved = resolveModel(type, compatModelId)
  return resolved?.apiModel || resolved?.id || compatModelId || ''
}

/**
 * Resolve API key for a specific model/type.
 * Order:
 * 1) model-level key
 * 2) registry global key
 * 3) runtime fallback key
 */
export const checkApiKey = (
  type: 'chat' | 'image' | 'video' | 'audio' = 'chat',
  modelId?: string
): string => {
  const resolvedModel = resolveModel(type, modelId)
  console.log(
    '[checkApiKey] type/model/resolved:',
    type,
    modelId,
    resolvedModel?.id,
    resolvedModel?.providerId
  )

  if (resolvedModel) {
    const provider = getProviderById(resolvedModel.providerId)
    const isVolcengineProvider =
      resolvedModel.providerId === 'volcengine' ||
      !!provider?.baseUrl?.toLowerCase().includes('volces.com')

    if (isVolcengineProvider) {
      const modelLevelKey = resolvedModel.apiKey?.trim()
      const providerLevelKey = provider?.apiKey?.trim()
      const dedicatedKey = modelLevelKey || providerLevelKey
      if (dedicatedKey) return dedicatedKey
      console.error('[checkApiKey] Volcengine dedicated key missing', {
        type,
        requestedModelId: modelId || null,
        resolvedModelId: resolvedModel.id,
        resolvedProviderId: resolvedModel.providerId,
        providerExists: !!provider,
        providerBaseUrl: provider?.baseUrl || null,
        hasModelLevelKey: !!modelLevelKey,
        hasProviderLevelKey: !!providerLevelKey
      })
      throw new ApiKeyError(
        'Volcengine models require a dedicated API key at model/provider level.'
      )
    }

    const modelApiKey = getApiKeyForModel(resolvedModel.id)
    if (modelApiKey) return modelApiKey
  }

  const registryKey = getRegistryApiKey()
  if (registryKey) return registryKey

  if (!runtimeApiKey) {
    throw new ApiKeyError(
      'API Key is missing. Please configure it in model settings.'
    )
  }

  return runtimeApiKey
}

/** Get API base URL for model/type */
export const getApiBase = (
  type: 'chat' | 'image' | 'video' | 'audio' = 'chat',
  modelId?: string
): string => {
  try {
    const resolvedModel = resolveModel(type, modelId)
    if (resolvedModel) {
      return getApiBaseUrlForModel(resolvedModel.id)
    }
    return DEFAULT_API_BASE
  } catch {
    return DEFAULT_API_BASE
  }
}

/** Get active chat model name for logging/default behavior */
export const getActiveChatModelName = (): string => {
  try {
    const model = getActiveChatModel()
    return model?.apiModel || model?.id || 'gpt-5.2'
  } catch {
    return 'gpt-5.2'
  }
}

// Re-export helpers from modelRegistry
export {
  getActiveModel,
  getActiveChatModel,
  getActiveVideoModel,
  getActiveImageModel,
  getActiveAudioModel
}

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// ============================================
// Generic helpers
// ============================================

/** Retry helper with exponential backoff */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000,
  abortSignal?: AbortSignal
): Promise<T> => {
  let lastError: unknown

  const isAbortError = (error: unknown): boolean => {
    const record = toRecord(error)
    const message = String(record.message || '')
    return (
      record.name === 'AbortError' ||
      message.includes('Request cancelled') ||
      message.includes('请求已取消') ||
      message.includes('aborted')
    )
  }

  for (let i = 0; i < maxRetries; i += 1) {
    if (abortSignal?.aborted) {
      throw new Error('Request cancelled')
    }

    try {
      return await operation()
    } catch (e: unknown) {
      lastError = e
      const errorRecord = toRecord(e)
      const message = String(errorRecord.message || '')
      const status = Number(errorRecord.status)
      const code = Number(errorRecord.code)

      if (isAbortError(e) || abortSignal?.aborted) {
        throw new Error('Request cancelled')
      }

      const isRetryableError =
        status === 429 ||
        code === 429 ||
        status === 504 ||
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('timed out') ||
        message.includes('timeout') ||
        message.includes('超时') ||
        message.includes('Gateway Timeout') ||
        message.includes('504') ||
        message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT') ||
        message.includes('network') ||
        message.includes('openai_error') ||
        status >= 500

      if (isRetryableError && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        console.warn(
          `Request failed, retrying (${i + 1}/${maxRetries}) in ${delay}ms`,
          message
        )

        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            if (abortSignal) {
              abortSignal.removeEventListener('abort', handleAbort)
            }
            resolve()
          }, delay)

          const handleAbort = () => {
            clearTimeout(timer)
            abortSignal?.removeEventListener('abort', handleAbort)
            reject(new Error('Request cancelled'))
          }

          if (abortSignal) {
            abortSignal.addEventListener('abort', handleAbort)
          }
        })

        continue
      }

      throw e
    }
  }

  throw lastError
}

const JSON_OUTPUT_GUARDRAILS = `

STRICT JSON OUTPUT RULES:
- Return exactly one valid JSON object or array, and nothing else.
- Do not wrap the JSON in markdown code fences.
- Do not output explanations, comments, <think> tags, or extra prose.
- Use double quotes for every key and every string value.
- Do not use trailing commas.
`.trim()

const stripThinkTags = (text: string): string =>
  String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()

const stripMarkdownJsonFences = (text: string): string => {
  let cleaned = String(text || '').trim()
  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch) {
    cleaned = fencedMatch[1]
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '')
    cleaned = cleaned.replace(/```\s*$/i, '')
  }
  return cleaned.trim()
}

const looksLikeJson = (text: string): boolean => {
  const trimmed = String(text || '').trim()
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  )
}

const extractBalancedJsonBlock = (text: string): string | null => {
  const input = String(text || '')
  let startIndex = -1
  const stack: string[] = []
  let quoteChar: '"' | "'" | null = null
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quoteChar) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quoteChar) {
        quoteChar = null
      }
      continue
    }

    if (char === '"' || char === "'") {
      quoteChar = char
      continue
    }

    if (char === '{' || char === '[') {
      if (stack.length === 0) {
        startIndex = index
      }
      stack.push(char)
      continue
    }

    if (char === '}' || char === ']') {
      if (stack.length === 0) continue
      const expected = char === '}' ? '{' : '['
      if (stack[stack.length - 1] !== expected) continue
      stack.pop()
      if (stack.length === 0 && startIndex >= 0) {
        return input.slice(startIndex, index + 1).trim()
      }
    }
  }

  return null
}

const removeControlCharacters = (text: string): string =>
  Array.from(text)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code === 9 || code === 10 || code === 13 || code >= 32
    })
    .join('')

const repairCommonJsonIssues = (text: string): string => {
  let fixed = stripMarkdownJsonFences(stripThinkTags(String(text || '')))
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u00A0/g, ' ')
  fixed = removeControlCharacters(fixed)

  fixed = fixed.replace(/\/\/.*?$/gm, '')
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '')
  fixed = fixed.replace(
    /([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(\s*:)/g,
    '$1"$2"$3'
  )
  fixed = fixed.replace(
    /([{,]\s*)([A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\-\u4e00-\u9fa5]*)(\s*:)/g,
    '$1"$2"$3'
  )
  fixed = fixed.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"')
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')

  return fixed.trim()
}

const buildJsonParseCandidates = (raw: string): string[] => {
  const cleaned = stripMarkdownJsonFences(stripThinkTags(raw))
  const extracted =
    extractBalancedJsonBlock(cleaned) || extractBalancedJsonBlock(raw)
  const candidates = [
    cleaned,
    extracted || '',
    repairCommonJsonIssues(cleaned),
    extracted ? repairCommonJsonIssues(extracted) : ''
  ]

  return candidates.filter((candidate, index) => {
    const trimmed = candidate.trim()
    return (
      trimmed.length > 0 &&
      candidates.findIndex((item) => item.trim() === trimmed) === index
    )
  })
}

const parseNestedJsonString = (value: unknown): unknown => {
  let current = value
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (typeof current !== 'string') {
      return current
    }
    const next = repairCommonJsonIssues(current)
    if (!looksLikeJson(next)) {
      return current
    }
    current = JSON.parse(next)
  }
  return current
}

export const parseJsonWithRecovery = <T = unknown>(
  raw: string,
  defaultValue?: T
): T => {
  const candidates = buildJsonParseCandidates(raw)

  for (const candidate of candidates) {
    try {
      return parseNestedJsonString(JSON.parse(candidate)) as T
    } catch {
      // Continue trying more tolerant candidates.
    }
  }

  if (defaultValue !== undefined) {
    return defaultValue
  }

  throw new Error('Failed to parse JSON response')
}

/** Remove markdown code fences around JSON and extract the JSON body when possible. */
export const cleanJsonString = (str: string): string => {
  if (!str) return '{}'

  const cleaned = stripMarkdownJsonFences(stripThinkTags(str))
  const extracted = extractBalancedJsonBlock(cleaned)
  return (extracted || cleaned).trim()
}

export const supportsNativeJsonObjectResponseFormat = (
  modelId: string
): boolean => {
  const model = String(modelId || '').toLowerCase()
  return !/claude|gemini/.test(model)
}

const isJsonResponseFormatUnsupportedError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('response_format') ||
    message.includes('json_object') ||
    message.includes('unsupported') ||
    message.includes('not support') ||
    message.includes('invalid parameter') ||
    message.includes('invalid param')
  )
}

const withJsonOutputGuardrails = (prompt: string): string => {
  const normalizedPrompt = String(prompt || '').trim()
  if (normalizedPrompt.includes('STRICT JSON OUTPUT RULES')) {
    return normalizedPrompt
  }
  return `${normalizedPrompt}\n\n${JSON_OUTPUT_GUARDRAILS}`.trim()
}

/** Parse HTTP error payload to Error with status field */
export const parseHttpError = async (response: Response): Promise<Error> => {
  const httpStatus = response.status
  let errorMessage = `HTTP error: ${httpStatus}`

  try {
    const errorData = await response.json()
    errorMessage = errorData.error?.message || errorMessage
  } catch {
    try {
      const errorText = await response.text()
      if (errorText) errorMessage = errorText
    } catch {
      // ignore
    }
  }

  const err = new Error(errorMessage) as Error & { status?: number }
  err.status = httpStatus
  return err
}

// ============================================
// Chat completion API
// ============================================

/** Non-stream chat completion */
export const chatCompletion = async (
  prompt: string,
  model: string = 'gpt-5.2',
  temperature: number = 0.7,
  maxTokens: number = 8192,
  responseFormat?: 'json_object',
  timeout: number = 600000,
  abortSignal?: AbortSignal
): Promise<string> => {
  const apiKey = checkApiKey('chat', model)
  const requestModel = resolveRequestModel('chat', model)
  const wantsJson = responseFormat === 'json_object'
  const canUseNativeJsonObject =
    wantsJson && supportsNativeJsonObjectResponseFormat(requestModel)
  const effectivePrompt =
    wantsJson && !canUseNativeJsonObject
      ? withJsonOutputGuardrails(prompt)
      : prompt

  const requestBody: Record<string, unknown> = {
    model: requestModel,
    messages: [{ role: 'user', content: effectivePrompt }],
    temperature
  }

  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    requestBody.max_tokens = maxTokens
  }

  if (canUseNativeJsonObject) {
    requestBody.response_format = { type: 'json_object' }
  }

  const controller = new AbortController()
  const handleExternalAbort = () => controller.abort()

  if (abortSignal) {
    if (abortSignal.aborted) {
      controller.abort()
    } else {
      abortSignal.addEventListener('abort', handleExternalAbort)
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const apiBase = getApiBase('chat', model)
    const resolved = resolveModel('chat', model)
    const endpoint = resolved?.endpoint || '/v1/chat/completions'

    const executeRequest = async (
      body: Record<string, unknown>
    ): Promise<Response> => {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        throw await parseHttpError(response)
      }

      return response
    }

    let response: Response
    try {
      response = await executeRequest(requestBody)
    } catch (error) {
      if (
        wantsJson &&
        canUseNativeJsonObject &&
        isJsonResponseFormatUnsupportedError(error)
      ) {
        delete requestBody.response_format
        requestBody.messages = [
          { role: 'user', content: withJsonOutputGuardrails(prompt) }
        ]
        response = await executeRequest(requestBody)
      } else {
        throw error
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    if (wantsJson) {
      return cleanJsonString(content)
    }
    return content
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled')
      }
      throw new Error(`Request timed out (${timeout}ms)`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    if (abortSignal) {
      abortSignal.removeEventListener('abort', handleExternalAbort)
    }
  }
}

/** Streaming chat completion (SSE) */
export const chatCompletionStream = async (
  prompt: string,
  model: string = 'gpt-5.2',
  temperature: number = 0.7,
  responseFormat: 'json_object' | undefined,
  timeout: number = 600000,
  onDelta?: (delta: string) => void,
  abortSignal?: AbortSignal
): Promise<string> => {
  const apiKey = checkApiKey('chat', model)
  const requestModel = resolveRequestModel('chat', model)
  const wantsJson = responseFormat === 'json_object'
  const canUseNativeJsonObject =
    wantsJson && supportsNativeJsonObjectResponseFormat(requestModel)
  const effectivePrompt =
    wantsJson && !canUseNativeJsonObject
      ? withJsonOutputGuardrails(prompt)
      : prompt

  const requestBody: Record<string, unknown> = {
    model: requestModel,
    messages: [{ role: 'user', content: effectivePrompt }],
    temperature,
    stream: true
  }

  if (canUseNativeJsonObject) {
    requestBody.response_format = { type: 'json_object' }
  }

  const controller = new AbortController()
  const handleExternalAbort = () => controller.abort()

  if (abortSignal) {
    if (abortSignal.aborted) {
      controller.abort()
    } else {
      abortSignal.addEventListener('abort', handleExternalAbort)
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const apiBase = getApiBase('chat', model)
    const resolved = resolveModel('chat', model)
    const endpoint = resolved?.endpoint || '/v1/chat/completions'

    const executeRequest = async (
      body: Record<string, unknown>
    ): Promise<Response> => {
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        throw await parseHttpError(response)
      }

      return response
    }

    let response: Response
    try {
      response = await executeRequest(requestBody)
    } catch (error) {
      if (
        wantsJson &&
        canUseNativeJsonObject &&
        isJsonResponseFormatUnsupportedError(error)
      ) {
        delete requestBody.response_format
        requestBody.messages = [
          { role: 'user', content: withJsonOutputGuardrails(prompt) }
        ]
        response = await executeRequest(requestBody)
      } else {
        throw error
      }
    }

    if (!response.body) {
      throw new Error('Response body is empty; cannot process stream response.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let fullText = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let boundaryIndex = buffer.indexOf('\n\n')
      while (boundaryIndex !== -1) {
        const chunk = buffer.slice(0, boundaryIndex).trim()
        buffer = buffer.slice(boundaryIndex + 2)

        if (chunk) {
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const dataStr = line.replace(/^data:\s*/, '')

            if (dataStr === '[DONE]') {
              clearTimeout(timeoutId)
              if (wantsJson) {
                return cleanJsonString(fullText)
              }
              return fullText
            }

            try {
              const payload = JSON.parse(dataStr)
              const delta =
                payload?.choices?.[0]?.delta?.content ||
                payload?.choices?.[0]?.message?.content ||
                ''
              if (delta) {
                fullText += delta
                onDelta?.(delta)
              }
            } catch {
              // Ignore malformed SSE JSON line.
            }
          }
        }

        boundaryIndex = buffer.indexOf('\n\n')
      }
    }

    clearTimeout(timeoutId)
    if (wantsJson) {
      return cleanJsonString(fullText)
    }
    return fullText
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled')
      }
      throw new Error(`Request timed out (${timeout}ms)`)
    }
    throw error
  } finally {
    if (abortSignal) {
      abortSignal.removeEventListener('abort', handleExternalAbort)
    }
  }
}

// ============================================
// API key verification
// ============================================

/** Verify whether a provided key can call chat endpoint */
export const verifyApiKey = async (
  key: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const apiBase = getApiBase('chat')
    const response = await fetch(`${apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: DEFAULT_CHAT_VERIFY_MODEL,
        messages: [{ role: 'user', content: 'Return 1 only.' }],
        temperature: 0.1,
        max_tokens: 5
      })
    })

    if (!response.ok) {
      let errorMessage = `Verification failed: ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.error?.message || errorMessage
      } catch {
        // ignore
      }
      return { success: false, message: errorMessage }
    }

    const data = await response.json()
    if (data.choices?.[0]?.message?.content !== undefined) {
      return { success: true, message: 'API Key 验证成功' }
    }

    return { success: false, message: '返回格式异常' }
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) || '网络错误' }
  }
}

// ============================================
// Media conversion helpers
// ============================================

/** Convert a remote video URL to data URL base64 */
export const convertVideoUrlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetchMediaWithCorsFallback(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch video: HTTP ${response.status}`)
    }

    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        resolve(base64String)
      }
      reader.onerror = () => {
        reject(new Error('Failed to convert video to base64'))
      }
      reader.readAsDataURL(blob)
    })
  } catch (error: unknown) {
    console.error('convertVideoUrlToBase64 failed:', error)
    throw new Error(
      `Failed to convert video to base64: ${getErrorMessage(error)}`
    )
  }
}

/**
 * Resize base64 PNG image to target size with cover strategy.
 * Return raw base64 (without data URI prefix).
 */
export const resizeImageToSize = async (
  base64Data: string,
  targetWidth: number,
  targetHeight: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to create canvas context'))
        return
      }

      const scale = Math.max(targetWidth / img.width, targetHeight / img.height)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      const offsetX = (targetWidth - scaledWidth) / 2
      const offsetY = (targetHeight - scaledHeight) / 2

      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight)

      const result = canvas
        .toDataURL('image/png')
        .replace(/^data:image\/png;base64,/, '')
      resolve(result)
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = `data:image/png;base64,${base64Data}`
  })
}

// ============================================
// Video model helpers
// ============================================

/** Get Veo model by reference mode and aspect ratio */
export const getVeoModelName = (
  hasReferenceImage: boolean,
  aspectRatio: AspectRatio
): string => {
  const orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape'
  if (hasReferenceImage) {
    return `veo_3_1_i2v_s_fast_fl_${orientation}`
  }
  return `veo_3_1_t2v_fast_${orientation}`
}

/** Map aspect ratio to Sora size */
export const getSoraVideoSize = (aspectRatio: AspectRatio): string => {
  const sizeMap: Record<AspectRatio, string> = {
    '16:9': '1280x720',
    '9:16': '720x1280',
    '1:1': '720x720'
  }
  return sizeMap[aspectRatio]
}
