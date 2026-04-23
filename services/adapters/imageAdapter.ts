/**
 * 图片模型适配器
 * 处理 Gemini Image API
 */

import {
  ImageModelDefinition,
  ImageGenerateOptions,
  AspectRatio
} from '../../types/model'
import {
  getApiKeyForModel,
  getApiBaseUrlForModel,
  getActiveImageModel
} from '../modelRegistry'
import {
  getImageApiFormat,
  getDefaultImageEndpoint,
  resolveOpenAiImageEndpoint,
  mapAspectRatioToOpenAiImageSize
} from '../imageModelUtils'
import { ApiKeyError } from './chatAdapter'

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * 重试操作
 */
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> => {
  let lastError: unknown = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      const errorRecord = toRecord(error)
      const status = Number(errorRecord.status)
      const message = getErrorMessage(error)
      // 400/401/403 错误不重试
      if (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        message.includes('400') ||
        message.includes('401') ||
        message.includes('403')
      ) {
        throw error
      }
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)))
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('请求失败，且未返回可识别错误信息')
}

const parseHttpErrorBody = async (res: Response): Promise<string> => {
  let errorMessage = `HTTP 错误: ${res.status}`
  try {
    const errorData = await res.json()
    errorMessage = errorData.error?.message || errorMessage
  } catch (e) {
    const errorText = await res.text()
    if (errorText) errorMessage = errorText
  }
  return errorMessage
}

const buildImageApiError = (status: number, backendMessage?: string): Error => {
  const detail = backendMessage?.trim()
  const withDetail = (message: string): string =>
    detail ? `${message}（接口信息：${detail}）` : message

  let message: string
  if (status === 400) {
    message = withDetail(
      '图片生成失败：提示词可能被风控拦截，请修改提示词后重试。'
    )
  } else if (status === 500 || status === 503) {
    message = withDetail('图片生成失败：服务器繁忙，请稍后重试。')
  } else if (status === 429) {
    message = withDetail('图片生成失败：请求过于频繁，请稍后再试。')
  } else {
    message = withDetail(`图片生成失败：接口请求异常（HTTP ${status}）。`)
  }

  const err = new Error(message) as Error & { status?: number }
  err.status = status
  return err
}

const MAX_IMAGE_PROMPT_CHARS = 5000
const OPENAI_IMAGE_QUALITY = 'medium'
const OPENAI_IMAGE_OUTPUT_FORMAT = 'png'
const OPENAI_IMAGE_OUTPUT_COMPRESSION = 100

const truncatePromptToMaxChars = (
  input: string,
  maxChars: number
): { text: string; wasTruncated: boolean; originalLength: number } => {
  const chars = Array.from(input)
  const originalLength = chars.length
  if (originalLength <= maxChars) {
    return { text: input, wasTruncated: false, originalLength }
  }
  return {
    text: chars.slice(0, maxChars).join(''),
    wasTruncated: true,
    originalLength
  }
}

const dataUrlToImageFile = (dataUrl: string, filename: string): File | null => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return null

  try {
    const mimeType = match[1]
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new File([bytes], filename, { type: mimeType })
  } catch {
    return null
  }
}

const resolveBrowserProxiedImageRequestUrl = (
  apiBase: string,
  endpoint: string
): string => {
  const absolute = `${apiBase}${endpoint}`
  if (typeof window === 'undefined') return absolute

  try {
    const target = new URL(absolute, window.location.origin)
    if (target.origin === window.location.origin) {
      return target.toString()
    }
    return `/api/image-proxy?url=${encodeURIComponent(target.toString())}`
  } catch {
    return absolute
  }
}

const extractImageFromOpenAiResponse = (response: unknown): string | null => {
  const responseRecord = toRecord(response)
  const data = Array.isArray(responseRecord.data) ? responseRecord.data : []
  const first = toRecord(data[0])
  if (!first) return null
  if (typeof first.b64_json === 'string' && first.b64_json) {
    const format =
      typeof first.output_format === 'string'
        ? first.output_format
        : OPENAI_IMAGE_OUTPUT_FORMAT
    return `data:image/${format};base64,${first.b64_json}`
  }
  if (typeof first.url === 'string' && first.url) {
    return String(first.url)
  }
  return null
}

/**
 * 调用图片生成 API
 */
export const callImageApi = async (
  options: ImageGenerateOptions,
  model?: ImageModelDefinition
): Promise<string> => {
  // 获取当前激活的模型
  const activeModel = model || getActiveImageModel()
  if (!activeModel) {
    throw new Error('没有可用的图片模型')
  }

  // 获取 API 配置
  const apiKey = getApiKeyForModel(activeModel.id)
  if (!apiKey) {
    throw new ApiKeyError('API Key 缺失，请在设置中配置 API Key')
  }

  const apiBase = getApiBaseUrlForModel(activeModel.id)
  const apiModel = activeModel.apiModel || activeModel.id
  const apiFormat = getImageApiFormat(activeModel)
  const endpointTemplate =
    activeModel.endpoint || getDefaultImageEndpoint(apiFormat, apiModel)
  const endpoint = endpointTemplate.replace('{model}', apiModel)

  // 确定宽高比
  const aspectRatio =
    options.aspectRatio || activeModel.params.defaultAspectRatio

  // 构建提示词
  let finalPrompt = options.prompt

  // 如果有参考图，添加一致性指令
  if (options.referenceImages && options.referenceImages.length > 0) {
    finalPrompt = `
      ⚠️⚠️⚠️ CRITICAL REQUIREMENTS - CHARACTER CONSISTENCY ⚠️⚠️⚠️

      Reference Images Information:
      - The FIRST image is the Scene/Environment reference.
      - Any subsequent images are Character references (Base Look or Variation).

      Task:
      Generate a cinematic shot matching this prompt: "${options.prompt}".

      ⚠️ ABSOLUTE REQUIREMENTS (NON-NEGOTIABLE):
      1. Scene Consistency:
         - STRICTLY maintain the visual style, lighting, and environment from the scene reference.

      2. Character Consistency - HIGHEST PRIORITY:
         If characters are present in the prompt, they MUST be IDENTICAL to the character reference images:
         • Facial Features: Eyes (color, shape, size), nose structure, mouth shape, facial contours must be EXACTLY the same
         • Hairstyle & Hair Color: Length, color, texture, and style must be PERFECTLY matched
         • Clothing & Outfit: Style, color, material, and accessories must be IDENTICAL
         • Body Type: Height, build, proportions must remain consistent

      ⚠️ DO NOT create variations or interpretations of the character - STRICT REPLICATION ONLY!
      ⚠️ Character appearance consistency is THE MOST IMPORTANT requirement!
    `
  }

  const promptLimitResult = truncatePromptToMaxChars(
    finalPrompt,
    MAX_IMAGE_PROMPT_CHARS
  )
  if (promptLimitResult.wasTruncated) {
    console.warn(
      `[ImagePrompt] Prompt exceeded ${MAX_IMAGE_PROMPT_CHARS} chars ` +
        `(${promptLimitResult.originalLength}). Truncated before image request.`
    )
  }
  finalPrompt = promptLimitResult.text

  if (apiFormat === 'openai') {
    const hasReferenceImages = Boolean(options.referenceImages?.length)
    const resolvedEndpoint = resolveOpenAiImageEndpoint(
      endpoint,
      hasReferenceImages,
      Boolean(activeModel.endpoint?.trim())
    )
    const openAiSize = mapAspectRatioToOpenAiImageSize(aspectRatio, apiModel)

    const response = await retryOperation(async () => {
      let res: Response
      const endpointUsesEdits = resolvedEndpoint.includes('/images/edits')
      const usableJsonReferenceSources = (options.referenceImages || []).filter(
        (item) => typeof item === 'string' && item.trim().length > 0
      )

      if (hasReferenceImages && endpointUsesEdits) {
        const files = (options.referenceImages || [])
          .map((img, index) =>
            dataUrlToImageFile(img, `reference-${index + 1}.png`)
          )
          .filter((file): file is File => Boolean(file))

        if (files.length === 0) {
          throw new Error('图片生成失败：参考图格式无效，请上传图片后重试。1')
        }

        const formData = new FormData()
        formData.append('model', apiModel)
        formData.append('prompt', finalPrompt)
        formData.append('size', openAiSize)
        formData.append('quality', OPENAI_IMAGE_QUALITY)
        formData.append('output_format', OPENAI_IMAGE_OUTPUT_FORMAT)
        formData.append(
          'output_compression',
          String(OPENAI_IMAGE_OUTPUT_COMPRESSION)
        )
        formData.append('n', '1')
        files.forEach((file) => formData.append('image[]', file))

        const requestUrl = resolveBrowserProxiedImageRequestUrl(
          apiBase,
          resolvedEndpoint
        )
        res = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: '*/*'
          },
          body: formData
        })
      } else {
        const requestBody: Record<string, unknown> = {
          model: apiModel,
          prompt: finalPrompt,
          size: openAiSize,
          quality: OPENAI_IMAGE_QUALITY,
          output_format: OPENAI_IMAGE_OUTPUT_FORMAT,
          output_compression: OPENAI_IMAGE_OUTPUT_COMPRESSION,
          n: 1
        }
        if (!endpointUsesEdits && usableJsonReferenceSources.length > 0) {
          requestBody.image =
            usableJsonReferenceSources.length === 1
              ? usableJsonReferenceSources[0]
              : usableJsonReferenceSources
        }

        const requestUrl = resolveBrowserProxiedImageRequestUrl(
          apiBase,
          resolvedEndpoint
        )
        res = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            Accept: '*/*'
          },
          body: JSON.stringify(requestBody)
        })
      }

      if (!res.ok) {
        const backendMessage = await parseHttpErrorBody(res)
        throw buildImageApiError(res.status, backendMessage)
      }

      return await res.json()
    })

    const imageData = extractImageFromOpenAiResponse(response)
    if (imageData) {
      return imageData
    }

    throw new Error('图片生成失败：OpenAI Images 未返回有效图片数据。')
  }

  // Gemini generateContent protocol
  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: finalPrompt }]
  if (options.referenceImages) {
    options.referenceImages.forEach((imgUrl) => {
      const match = imgUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/)
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        })
      }
    })
  }

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: parts
      }
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: aspectRatio
      }
    }
  }

  const response = await retryOperation(async () => {
    const requestUrl = resolveBrowserProxiedImageRequestUrl(apiBase, endpoint)
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: '*/*'
      },
      body: JSON.stringify(requestBody)
    })

    if (!res.ok) {
      const backendMessage = await parseHttpErrorBody(res)
      throw buildImageApiError(res.status, backendMessage)
    }

    return await res.json()
  })

  const responseRecord = toRecord(response)
  const candidates = Array.isArray(responseRecord.candidates)
    ? responseRecord.candidates
    : []
  if (
    candidates.length > 0 &&
    toRecord(candidates[0]).content &&
    Array.isArray(toRecord(toRecord(candidates[0]).content).parts)
  ) {
    const firstCandidate = toRecord(candidates[0])
    const content = toRecord(firstCandidate.content)
    const candidateParts = Array.isArray(content.parts) ? content.parts : []
    for (const part of candidateParts) {
      const partRecord = toRecord(part)
      const inlineData = toRecord(partRecord.inlineData)
      if (typeof inlineData.data === 'string' && inlineData.data) {
        return `data:image/png;base64,${inlineData.data}`
      }
    }
  }

  const hasSafetyBlock =
    !!toRecord(responseRecord.promptFeedback).blockReason ||
    candidates.some((candidate: unknown) => {
      const finishReason = String(
        toRecord(candidate).finishReason || ''
      ).toUpperCase()
      return finishReason.includes('SAFETY') || finishReason.includes('BLOCK')
    })

  if (hasSafetyBlock) {
    throw new Error('图片生成失败：提示词可能被风控拦截，请修改提示词后重试。')
  }

  throw new Error('图片生成失败：未返回有效图片数据，请重试或调整提示词。')
}

/**
 * 检查宽高比是否支持
 */
export const isAspectRatioSupported = (
  aspectRatio: AspectRatio,
  model?: ImageModelDefinition
): boolean => {
  const activeModel = model || getActiveImageModel()
  if (!activeModel) return false

  return activeModel.params.supportedAspectRatios.includes(aspectRatio)
}
