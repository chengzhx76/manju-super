/**
 * 模型注册中心
 * 管理所有已注册的模型，提供 CRUD 操作
 */

import {
  ModelType,
  ModelDefinition,
  ModelProvider,
  ModelRegistryState,
  AssetLibraryConfig,
  ActiveModels,
  ChatModelDefinition,
  ImageModelDefinition,
  VideoModelDefinition,
  AudioModelDefinition,
  BUILTIN_PROVIDERS,
  ALL_BUILTIN_MODELS,
  DEFAULT_ACTIVE_MODELS,
  AspectRatio,
  VideoDuration
} from '../types/model'
import { normalizeChatModelId } from './modelIdUtils'

// localStorage 键名
const STORAGE_KEY = 'bigbanana_model_registry'
const API_KEY_STORAGE_KEY = 'antsk_api_key'
const DEFAULT_ASSET_LIBRARY_CONFIG: AssetLibraryConfig = {
  id: 'asset_lib_default',
  address: '',
  access_key: '',
  secret_key: '',
  isDefault: true
}

// 规范化 URL（去尾部斜杠、转小写）用于去重
const normalizeBaseUrl = (url: string): string =>
  url.trim().replace(/\/+$/, '').toLowerCase()

const createAssetLibraryConfigId = (): string =>
  `asset_lib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const normalizeAssetLibraryConfig = (
  config?: Partial<AssetLibraryConfig>
): AssetLibraryConfig => ({
  id: config?.id?.trim() || createAssetLibraryConfigId(),
  address: (config?.address || '').trim().replace(/\/+$/, ''),
  access_key: (config?.access_key || '').trim(),
  secret_key: (config?.secret_key || '').trim(),
  isDefault: !!config?.isDefault
})

// 运行时状态缓存
let registryState: ModelRegistryState | null = null

// ============================================
// 状态管理
// ============================================

/**
 * 获取默认状态
 */
const getDefaultState = (): ModelRegistryState => ({
  providers: [...BUILTIN_PROVIDERS],
  models: [...ALL_BUILTIN_MODELS],
  activeModels: { ...DEFAULT_ACTIVE_MODELS },
  globalApiKey: localStorage.getItem(API_KEY_STORAGE_KEY) || undefined,
  assetLibraryConfigs: []
})

/**
 * 从 localStorage 加载状态
 */
export const loadRegistry = (): ModelRegistryState => {
  if (registryState) {
    return registryState
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as ModelRegistryState
      const deprecatedVideoModelIds = [
        'veo',
        'veo-3.1',
        'veo-r2v',
        'veo_3_0_r2v_fast_portrait',
        'veo_3_0_r2v_fast_landscape',
        'veo_3_1_t2v_fast_landscape',
        'veo_3_1_t2v_fast_portrait',
        'veo_3_1_i2v_s_fast_fl_landscape',
        'veo_3_1_i2v_s_fast_fl_portrait'
      ]

      // 兼容旧版本：activeModels 可能缺少 audio 字段
      parsed.activeModels = {
        ...DEFAULT_ACTIVE_MODELS,
        ...(parsed.activeModels || {})
      }

      let chatModelAliasMigrated = false
      const hasBuiltinGpt54 = parsed.models.some(
        (m) => m.type === 'chat' && m.id === 'gpt-5.4'
      )
      parsed.models = parsed.models.flatMap((model) => {
        if (!(model.type === 'chat' && model.id === 'gpt-41')) {
          return [model]
        }

        chatModelAliasMigrated = true

        if (hasBuiltinGpt54) {
          return []
        }

        return [
          {
            ...model,
            id: 'gpt-5.4',
            name: 'GPT-5.4',
            apiModel: 'gpt-5.4'
          }
        ]
      })

      const normalizedActiveChatModel = normalizeChatModelId(
        parsed.activeModels.chat
      )
      if (
        normalizedActiveChatModel &&
        normalizedActiveChatModel !== parsed.activeModels.chat
      ) {
        parsed.activeModels.chat = normalizedActiveChatModel
        chatModelAliasMigrated = true
      }

      // 确保内置模型和提供商始终存在
      const builtInProviderIds = BUILTIN_PROVIDERS.map((p) => p.id)
      const builtInModelIds = ALL_BUILTIN_MODELS.map((m) => m.id)

      // 合并内置提供商
      const existingProviderIds = parsed.providers.map((p) => p.id)
      BUILTIN_PROVIDERS.forEach((bp) => {
        if (!existingProviderIds.includes(bp.id)) {
          parsed.providers.unshift(bp)
        }
      })

      // 按 baseUrl 去重提供商（保留先出现的项，通常为内置）
      const seenBaseUrls = new Set<string>()
      parsed.providers = parsed.providers.filter((p) => {
        const key = normalizeBaseUrl(p.baseUrl)
        if (seenBaseUrls.has(key)) return false
        seenBaseUrls.add(key)
        return true
      })

      // 合并内置模型，并确保内置模型的参数与代码保持同步
      const existingModelIds = parsed.models.map((m) => m.id)
      ALL_BUILTIN_MODELS.forEach((bm) => {
        const existingIndex = parsed.models.findIndex((m) => m.id === bm.id)
        if (existingIndex === -1) {
          // 内置模型不存在，添加
          parsed.models.push(bm)
        } else {
          // 内置模型已存在：以代码定义为基础，保留用户的个性化设置
          const existing = parsed.models[existingIndex]
          // 用户可调整的偏好参数（defaultAspectRatio, temperature, maxTokens, defaultDuration 等）
          // 结构性参数（supportedAspectRatios, supportedDurations, mode 等）始终从代码同步
          const USER_PREF_KEYS = [
            'defaultAspectRatio',
            'temperature',
            'maxTokens',
            'defaultDuration'
          ] as const
          const mergedParams = { ...bm.params }
          const existingParams = existing.params
          const mutableMergedParams = mergedParams as Record<string, unknown>
          const existingParamsRecord = existingParams as Record<string, unknown>
          if (existingParams) {
            for (const key of USER_PREF_KEYS) {
              const existingValue = existingParamsRecord[key]
              if (existingValue !== undefined) {
                if (key === 'defaultDuration') {
                  const candidate = existingValue
                  const supported = (
                    mergedParams as { supportedDurations?: unknown }
                  ).supportedDurations
                  if (
                    Array.isArray(supported) &&
                    !supported.includes(candidate)
                  ) {
                    continue
                  }
                }
                mutableMergedParams[key] = existingValue
              }
            }
          }
          parsed.models[existingIndex] = {
            ...bm,
            isEnabled: existing.isEnabled,
            // Keep user-configured model-level API key for built-in models.
            apiKey: existing.apiKey?.trim() || undefined,
            params: mergedParams
          }
        }
      })

      // 按代码中的内置顺序重排内置模型，保证 UI 展示顺序一致
      // 自定义模型保持在内置模型之后，并保持各自相对顺序
      const builtInModelOrder = new Map(
        ALL_BUILTIN_MODELS.map((m, index) => [m.id, index])
      )
      const modelIdsBeforeReorder = parsed.models.map((m) => m.id).join('|')
      parsed.models = parsed.models
        .map((model, index) => ({ model, index }))
        .sort((a, b) => {
          const aOrder = builtInModelOrder.has(a.model.id)
            ? (builtInModelOrder.get(a.model.id) as number)
            : Number.MAX_SAFE_INTEGER
          const bOrder = builtInModelOrder.has(b.model.id)
            ? (builtInModelOrder.get(b.model.id) as number)
            : Number.MAX_SAFE_INTEGER
          if (aOrder !== bOrder) return aOrder - bOrder
          return a.index - b.index
        })
        .map((item) => item.model)
      const modelIdsAfterReorder = parsed.models.map((m) => m.id).join('|')
      const modelsReordered = modelIdsBeforeReorder !== modelIdsAfterReorder

      // 迁移缺失的 apiModel（优先从 id 或 providerId 前缀推断）
      parsed.models = parsed.models.map((m) => {
        if (m.apiModel) return m
        if (m.providerId && m.id.startsWith(`${m.providerId}:`)) {
          return { ...m, apiModel: m.id.slice(m.providerId.length + 1) }
        }
        return { ...m, apiModel: m.id }
      })

      // 清理旧的已废弃视频模型
      const modelCountBefore = parsed.models.length
      parsed.models = parsed.models.filter(
        (m) => !(m.type === 'video' && deprecatedVideoModelIds.includes(m.id))
      )
      // Clean legacy AntSK built-in alias model entries:
      // doubao-seedance-1-5-pro-251215 on /v1/videos should be replaced by
      // doubao-seedance-1-5-pro (AntSK) and volcengine 251215 task model.
      parsed.models = parsed.models.filter((m) => {
        if (!(m.type === 'video' && m.isBuiltIn)) return true

        const normalizedApiModel = (m.apiModel || '').trim().toLowerCase()
        const normalizedId = (m.id || '').trim().toLowerCase()
        const normalizedEndpoint = (m.endpoint || '').trim().toLowerCase()

        const isLegacyAntskDoubaoAlias =
          m.providerId === 'antsk' &&
          normalizedEndpoint.includes('/v1/videos') &&
          (normalizedApiModel === 'doubao-seedance-1-5-pro-251215' ||
            (!normalizedApiModel &&
              normalizedId.includes('doubao-seedance-1-5-pro-251215')))

        return !isLegacyAntskDoubaoAlias
      })
      const modelsRemoved = modelCountBefore - parsed.models.length

      // 迁移激活视频模型
      let activeModelMigrated = false
      if (
        deprecatedVideoModelIds.includes(parsed.activeModels.video) ||
        parsed.activeModels.video === 'veo_3_1' ||
        parsed.activeModels.video?.startsWith('veo_3_1_')
      ) {
        parsed.activeModels.video = 'veo_3_1-fast'
        activeModelMigrated = true
      }

      const activeVideoExists = parsed.models.some(
        (m) =>
          m.type === 'video' &&
          m.id === parsed.activeModels.video &&
          m.isEnabled
      )
      if (!activeVideoExists) {
        parsed.activeModels.video = DEFAULT_ACTIVE_MODELS.video
        activeModelMigrated = true
      }

      // 校验各类型激活模型都存在且可用
      ;(['chat', 'image', 'audio'] as ModelType[]).forEach((type) => {
        const activeModelId = parsed.activeModels[type]
        const activeExists = parsed.models.some(
          (m) => m.type === type && m.id === activeModelId && m.isEnabled
        )
        if (!activeExists) {
          parsed.activeModels[type] = DEFAULT_ACTIVE_MODELS[type]
          activeModelMigrated = true
        }
      })

      // 同步全局 API Key
      parsed.globalApiKey =
        localStorage.getItem(API_KEY_STORAGE_KEY) || parsed.globalApiKey

      // 修正 volcengine 提供商的 isBuiltIn 状态（用户反馈不是内置的）
      let providerMigrated = false
      const volcProvider = parsed.providers.find((p) => p.id === 'volcengine')
      if (volcProvider && volcProvider.isBuiltIn) {
        volcProvider.isBuiltIn = false
        providerMigrated = true
      }

      // 将 globalApiKey 迁移至 antsk（内置供应商）
      let globalApiKeyMigrated = false
      if (parsed.globalApiKey) {
        const antskProvider = parsed.providers.find((p) => p.id === 'antsk')
        if (antskProvider && !antskProvider.apiKey) {
          antskProvider.apiKey = parsed.globalApiKey
        }
        parsed.globalApiKey = undefined
        localStorage.removeItem(API_KEY_STORAGE_KEY)
        globalApiKeyMigrated = true
      }

      let assetLibraryConfigMigrated = false
      const parsedAny = parsed as ModelRegistryState & {
        assetLibraryConfig?: Partial<AssetLibraryConfig>
      }
      const legacyAssetLibraryConfig = parsedAny.assetLibraryConfig
      const rawAssetLibraryConfigs = Array.isArray(parsed.assetLibraryConfigs)
        ? parsed.assetLibraryConfigs
        : []

      let normalizedAssetLibraryConfigs = rawAssetLibraryConfigs.map((config) =>
        normalizeAssetLibraryConfig(config)
      )

      // 从旧版本的单配置字段迁移到多配置数组
      if (
        normalizedAssetLibraryConfigs.length === 0 &&
        legacyAssetLibraryConfig &&
        (legacyAssetLibraryConfig.address ||
          legacyAssetLibraryConfig.access_key ||
          legacyAssetLibraryConfig.secret_key)
      ) {
        normalizedAssetLibraryConfigs = [
          normalizeAssetLibraryConfig({
            ...legacyAssetLibraryConfig,
            isDefault: true
          })
        ]
        assetLibraryConfigMigrated = true
      }

      // 保证每条记录有唯一 ID，并确保仅有一条默认记录
      const usedAssetLibraryIds = new Set<string>()
      normalizedAssetLibraryConfigs = normalizedAssetLibraryConfigs.map(
        (config) => {
          let nextId = config.id
          while (!nextId || usedAssetLibraryIds.has(nextId)) {
            nextId = createAssetLibraryConfigId()
          }
          usedAssetLibraryIds.add(nextId)
          return { ...config, id: nextId }
        }
      )
      const defaultCount = normalizedAssetLibraryConfigs.filter(
        (config) => config.isDefault
      ).length
      if (normalizedAssetLibraryConfigs.length > 0 && defaultCount !== 1) {
        normalizedAssetLibraryConfigs = normalizedAssetLibraryConfigs.map(
          (config, index) => ({
            ...config,
            isDefault: index === 0
          })
        )
        assetLibraryConfigMigrated = true
      }

      const beforeSerialized = JSON.stringify(rawAssetLibraryConfigs)
      const afterSerialized = JSON.stringify(normalizedAssetLibraryConfigs)
      if (beforeSerialized !== afterSerialized) {
        assetLibraryConfigMigrated = true
      }
      parsed.assetLibraryConfigs = normalizedAssetLibraryConfigs

      registryState = parsed

      // 如果发生了迁移，立即回写 localStorage，避免每次加载都重复执行
      if (
        modelsRemoved > 0 ||
        activeModelMigrated ||
        modelsReordered ||
        chatModelAliasMigrated ||
        providerMigrated ||
        globalApiKeyMigrated ||
        assetLibraryConfigMigrated
      ) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
          console.log(
            `🔄 模型注册中心迁移完成：清理 ${modelsRemoved} 个废弃模型`
          )
        } catch (e) {
          // 回写失败不影响运行，下次加载仍会重新迁移
        }
      }

      return parsed
    }
  } catch (e) {
    console.error('加载模型注册中心失败:', e)
  }

  registryState = getDefaultState()
  return registryState
}

/**
 * 保存状态到 localStorage
 */
export const saveRegistry = (state: ModelRegistryState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    registryState = state
  } catch (e) {
    console.error('保存模型注册中心失败:', e)
  }
}

/**
 * 获取当前状态
 */
export const getRegistryState = (): ModelRegistryState => {
  return loadRegistry()
}

/**
 * 重置为默认状态
 */
export const resetRegistry = (): void => {
  registryState = null
  localStorage.removeItem(STORAGE_KEY)
  loadRegistry()
}

// ============================================
// 提供商管理
// ============================================

/**
 * 获取所有提供商
 */
export const getProviders = (): ModelProvider[] => {
  return loadRegistry().providers
}

/**
 * 根据 ID 获取提供商
 */
export const getProviderById = (id: string): ModelProvider | undefined => {
  return getProviders().find((p) => p.id === id)
}

/**
 * 获取默认提供商
 */
export const getDefaultProvider = (): ModelProvider => {
  return getProviders().find((p) => p.isDefault) || BUILTIN_PROVIDERS[0]
}

/**
 * 添加提供商
 */
export const addProvider = (
  provider: Omit<ModelProvider, 'id' | 'isBuiltIn'>
): ModelProvider => {
  const state = loadRegistry()
  const normalized = normalizeBaseUrl(provider.baseUrl)
  const existing = state.providers.find(
    (p) => normalizeBaseUrl(p.baseUrl) === normalized
  )
  if (existing) return existing
  const newProvider: ModelProvider = {
    ...provider,
    id: `provider_${Date.now()}`,
    isBuiltIn: false
  }
  state.providers.push(newProvider)
  saveRegistry(state)
  return newProvider
}

/**
 * 更新提供商
 */
export const updateProvider = (
  id: string,
  updates: Partial<ModelProvider>
): boolean => {
  const state = loadRegistry()
  const index = state.providers.findIndex((p) => p.id === id)
  if (index === -1) return false

  // 内置提供商不能修改某些属性
  if (state.providers[index].isBuiltIn) {
    delete updates.id
    delete updates.isBuiltIn
    delete updates.baseUrl
  }

  state.providers[index] = { ...state.providers[index], ...updates }
  saveRegistry(state)
  return true
}

/**
 * 设置默认提供商
 */
export const setDefaultProvider = (id: string): boolean => {
  const state = loadRegistry()
  const providerExists = state.providers.some((p) => p.id === id)
  if (!providerExists) return false

  state.providers = state.providers.map((p) => ({
    ...p,
    isDefault: p.id === id
  }))

  saveRegistry(state)
  return true
}

/**
 * 删除提供商
 */
export const removeProvider = (id: string): boolean => {
  const state = loadRegistry()
  const provider = state.providers.find((p) => p.id === id)

  // 不能删除内置提供商
  if (!provider || provider.isBuiltIn) return false

  // 检查是否仍有模型关联
  const hasModels = state.models.some((m) => m.providerId === id)
  if (hasModels) return false // 需要先删除关联模型

  state.providers = state.providers.filter((p) => p.id !== id)

  saveRegistry(state)
  return true
}

// ============================================
// 模型管理
// ============================================

/**
 * 获取所有模型
 */
export const getModels = (type?: ModelType): ModelDefinition[] => {
  const state = loadRegistry()
  const models = state.models.filter(
    (m) => !(m.type === 'video' && m.isBuiltIn && m.id === 'veo')
  )
  if (type) {
    const typedModels = models.filter((m) => m.type === type)

    // Video model ordering:
    // 1) non-Volcengine models first
    // 2) built-in before custom within each group
    // 3) keep sora-2 pinned to top of non-Volcengine built-ins
    // 4) otherwise preserve relative order
    if (type === 'video') {
      const providersById = new Map(
        state.providers.map((provider) => [provider.id, provider])
      )
      const isVolcengineModel = (model: ModelDefinition): boolean => {
        if (model.providerId === 'volcengine') return true
        const provider = providersById.get(model.providerId)
        return !!provider?.baseUrl?.toLowerCase().includes('volces.com')
      }

      return typedModels
        .map((model, index) => ({
          model,
          index,
          isVolcengine: isVolcengineModel(model)
        }))
        .sort((a, b) => {
          const aVolcPriority = a.isVolcengine ? 1 : 0
          const bVolcPriority = b.isVolcengine ? 1 : 0
          if (aVolcPriority !== bVolcPriority)
            return aVolcPriority - bVolcPriority

          const aBuiltInPriority = a.model.isBuiltIn ? 0 : 1
          const bBuiltInPriority = b.model.isBuiltIn ? 0 : 1
          if (aBuiltInPriority !== bBuiltInPriority)
            return aBuiltInPriority - bBuiltInPriority

          const aSoraPriority = a.model.id === 'sora-2' ? 0 : 1
          const bSoraPriority = b.model.id === 'sora-2' ? 0 : 1
          if (aSoraPriority !== bSoraPriority)
            return aSoraPriority - bSoraPriority

          return a.index - b.index
        })
        .map((item) => item.model)
    }

    return typedModels
  }
  return models
}

/**
 * 获取对话模型列表
 */
export const getChatModels = (): ChatModelDefinition[] => {
  return getModels('chat') as ChatModelDefinition[]
}

/**
 * 获取图片模型列表
 */
export const getImageModels = (): ImageModelDefinition[] => {
  return getModels('image') as ImageModelDefinition[]
}

/**
 * 获取视频模型列表
 */
export const getVideoModels = (): VideoModelDefinition[] => {
  return getModels('video') as VideoModelDefinition[]
}

/**
 * 获取配音模型列表
 */
export const getAudioModels = (): AudioModelDefinition[] => {
  return getModels('audio') as AudioModelDefinition[]
}

/**
 * 根据 ID 获取模型
 */
export const getModelById = (id: string): ModelDefinition | undefined => {
  return getModels().find((m) => m.id === id)
}

/**
 * 获取当前激活的模型
 */
export const getActiveModel = (
  type: ModelType
): ModelDefinition | undefined => {
  const state = loadRegistry()
  const activeId = state.activeModels[type]
  return getModelById(activeId)
}

/**
 * 获取当前激活的对话模型
 */
export const getActiveChatModel = (): ChatModelDefinition | undefined => {
  return getActiveModel('chat') as ChatModelDefinition | undefined
}

/**
 * 获取当前激活的图片模型
 */
export const getActiveImageModel = (): ImageModelDefinition | undefined => {
  return getActiveModel('image') as ImageModelDefinition | undefined
}

/**
 * 获取当前激活的视频模型
 */
export const getActiveVideoModel = (): VideoModelDefinition | undefined => {
  return getActiveModel('video') as VideoModelDefinition | undefined
}

/**
 * 获取当前激活的配音模型
 */
export const getActiveAudioModel = (): AudioModelDefinition | undefined => {
  return getActiveModel('audio') as AudioModelDefinition | undefined
}

/**
 * 设置激活的模型
 */
export const setActiveModel = (type: ModelType, modelId: string): boolean => {
  const model = getModelById(modelId)
  if (!model || model.type !== type || !model.isEnabled) return false

  const state = loadRegistry()
  state.activeModels[type] = modelId
  saveRegistry(state)
  return true
}

/**
 * 注册新模型
 * @param model - 模型定义（可包含自定义 id，不包含 isBuiltIn）
 */
export const registerModel = (
  model: Omit<ModelDefinition, 'id' | 'isBuiltIn'> & { id?: string }
): ModelDefinition => {
  const state = loadRegistry()

  const providedId = model.id?.trim()
  const apiModel = model.apiModel?.trim()
  const baseId =
    providedId ||
    (apiModel ? `${model.providerId}:${apiModel}` : `model_${Date.now()}`)
  let modelId = baseId

  // 若未显式提供 ID，则自动生成唯一 ID（允许 API 模型名重复）
  if (!providedId) {
    let suffix = 1
    while (state.models.some((m) => m.id === modelId)) {
      modelId = `${baseId}_${suffix++}`
    }
  } else if (state.models.some((m) => m.id === modelId)) {
    throw new Error(`模型 ID "${modelId}" 已存在，请使用其他 ID`)
  }

  const newModel = {
    ...model,
    id: modelId,
    apiModel:
      apiModel ||
      (model.providerId && modelId.startsWith(`${model.providerId}:`)
        ? modelId.slice(model.providerId.length + 1)
        : modelId),
    isBuiltIn: false
  } as ModelDefinition

  state.models.push(newModel)
  saveRegistry(state)
  return newModel
}

/**
 * 更新模型
 */
export const updateModel = (
  id: string,
  updates: Partial<ModelDefinition>
): boolean => {
  const state = loadRegistry()
  const index = state.models.findIndex((m) => m.id === id)
  if (index === -1) return false

  // 内置模型仅开放少量可编辑字段：
  // - isEnabled: 启用/禁用
  // - params: 参数偏好（比例、时长等）
  // - apiKey: 模型专属密钥（覆盖全局/Provider）
  if (state.models[index].isBuiltIn) {
    const allowedUpdates: Partial<ModelDefinition> = {}
    if (updates.isEnabled !== undefined)
      allowedUpdates.isEnabled = updates.isEnabled
    if (updates.params) allowedUpdates.params = updates.params
    if (updates.apiKey !== undefined) {
      allowedUpdates.apiKey = updates.apiKey?.trim() || undefined
    }
    state.models[index] = {
      ...state.models[index],
      ...allowedUpdates
    } as ModelDefinition
  } else {
    state.models[index] = {
      ...state.models[index],
      ...updates
    } as ModelDefinition
  }

  saveRegistry(state)
  return true
}

/**
 * 删除模型
 */
export const removeModel = (id: string): boolean => {
  const state = loadRegistry()
  const model = state.models.find((m) => m.id === id)

  // 不能删除内置模型
  if (!model || model.isBuiltIn) return false

  // 如果删除的是当前激活的模型，切换到同类型的第一个启用模型
  if (state.activeModels[model.type] === id) {
    const fallback = state.models.find(
      (m) => m.type === model.type && m.id !== id && m.isEnabled
    )
    if (fallback) {
      state.activeModels[model.type] = fallback.id
    }
  }

  state.models = state.models.filter((m) => m.id !== id)
  saveRegistry(state)
  return true
}

/**
 * 启用/禁用模型
 */
export const toggleModelEnabled = (id: string, enabled: boolean): boolean => {
  return updateModel(id, { isEnabled: enabled })
}

// ============================================
// API Key 管理
// ============================================

/**
 * 获取全局 API Key
 */
export const getGlobalApiKey = (): string | undefined => {
  return (
    loadRegistry().globalApiKey ||
    localStorage.getItem(API_KEY_STORAGE_KEY) ||
    undefined
  )
}

/**
 * 设置全局 API Key
 */
export const setGlobalApiKey = (apiKey: string): void => {
  const state = loadRegistry()
  state.globalApiKey = apiKey
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
  saveRegistry(state)
}

/**
 * 获取资产库配置列表
 */
export const getAssetLibraryConfigs = (): AssetLibraryConfig[] => {
  const state = loadRegistry()
  return state.assetLibraryConfigs || []
}

/**
 * 获取当前使用的资产库配置
 */
export const getAssetLibraryConfig = (): AssetLibraryConfig => {
  const configs = getAssetLibraryConfigs()
  return (
    configs.find((config) => config.isDefault) ||
    configs[0] || { ...DEFAULT_ASSET_LIBRARY_CONFIG }
  )
}

/**
 * 添加资产库配置
 */
export const addAssetLibraryConfig = (
  config: Omit<AssetLibraryConfig, 'id' | 'isDefault'>
): AssetLibraryConfig => {
  const state = loadRegistry()
  const newConfig = normalizeAssetLibraryConfig({
    ...config,
    isDefault: state.assetLibraryConfigs.length === 0
  })
  state.assetLibraryConfigs.push(newConfig)
  saveRegistry(state)
  return newConfig
}

/**
 * 更新资产库配置
 */
export const updateAssetLibraryConfig = (
  id: string,
  updates: Partial<AssetLibraryConfig>
): boolean => {
  const state = loadRegistry()
  const index = state.assetLibraryConfigs.findIndex((config) => config.id === id)
  if (index === -1) return false

  const merged = normalizeAssetLibraryConfig({
    ...state.assetLibraryConfigs[index],
    ...updates,
    id
  })
  state.assetLibraryConfigs[index] = {
    ...merged,
    isDefault: state.assetLibraryConfigs[index].isDefault
  }
  saveRegistry(state)
  return true
}

/**
 * 设置默认资产库配置
 */
export const setDefaultAssetLibraryConfig = (id: string): boolean => {
  const state = loadRegistry()
  const exists = state.assetLibraryConfigs.some((config) => config.id === id)
  if (!exists) return false

  state.assetLibraryConfigs = state.assetLibraryConfigs.map((config) => ({
    ...config,
    isDefault: config.id === id
  }))
  saveRegistry(state)
  return true
}

/**
 * 删除资产库配置
 */
export const removeAssetLibraryConfig = (id: string): boolean => {
  const state = loadRegistry()
  const target = state.assetLibraryConfigs.find((config) => config.id === id)
  if (!target) return false

  state.assetLibraryConfigs = state.assetLibraryConfigs.filter(
    (config) => config.id !== id
  )
  if (target.isDefault && state.assetLibraryConfigs.length > 0) {
    state.assetLibraryConfigs[0].isDefault = true
  }
  saveRegistry(state)
  return true
}

/**
 * 兼容旧调用：更新当前使用配置（不存在则自动新增）
 */
export const setAssetLibraryConfig = (
  config: Partial<AssetLibraryConfig>
): void => {
  const state = loadRegistry()
  const current =
    state.assetLibraryConfigs.find((item) => item.isDefault) ||
    state.assetLibraryConfigs[0]
  if (current) {
    const index = state.assetLibraryConfigs.findIndex(
      (item) => item.id === current.id
    )
    state.assetLibraryConfigs[index] = normalizeAssetLibraryConfig({
      ...current,
      ...config,
      id: current.id,
      isDefault: true
    })
  } else {
    state.assetLibraryConfigs.push(
      normalizeAssetLibraryConfig({
        ...DEFAULT_ASSET_LIBRARY_CONFIG,
        ...config,
        isDefault: true
      })
    )
  }
  saveRegistry(state)
}

/**
 * 获取模型对应的 API Key
 * 优先级：模型专属 Key > 提供商 Key > 全局 Key
 */
export const getApiKeyForModel = (modelId: string): string | undefined => {
  const model = getModelById(modelId)
  if (!model) return getGlobalApiKey()

  // 1. 优先使用模型专属 API Key
  if (model.apiKey) {
    return model.apiKey
  }

  // 2. 其次使用提供商的 API Key
  const provider = getProviderById(model.providerId)
  if (provider?.apiKey) {
    return provider.apiKey
  }

  // 3. 最后使用全局 API Key
  return getGlobalApiKey()
}

/**
 * 获取模型对应的 API 基础 URL
 */
export const getApiBaseUrlForModel = (modelId: string): string => {
  const model = getModelById(modelId)
  if (!model) return BUILTIN_PROVIDERS[0].baseUrl.replace(/\/+$/, '')

  const provider = getProviderById(model.providerId)
  const baseUrl = provider?.baseUrl || BUILTIN_PROVIDERS[0].baseUrl
  return baseUrl.replace(/\/+$/, '')
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取激活模型的完整配置
 */
export const getActiveModelsConfig = (): ActiveModels => {
  return loadRegistry().activeModels
}

/**
 * 检查模型是否可用（已启用且有 API Key）
 */
export const isModelAvailable = (modelId: string): boolean => {
  const model = getModelById(modelId)
  if (!model || !model.isEnabled) return false

  const apiKey = getApiKeyForModel(modelId)
  return !!apiKey
}

// ============================================
// 默认值辅助函数（向后兼容）
// ============================================

/**
 * 获取默认横竖屏比例（模型默认值）
 */
export const getDefaultAspectRatio = (): AspectRatio => {
  const imageModel = getActiveImageModel()
  if (imageModel) {
    return imageModel.params.defaultAspectRatio
  }
  return '16:9'
}

/**
 * 获取用户选择的横竖屏比例
 * 读取当前激活图片模型的 defaultAspectRatio
 */
export const getUserAspectRatio = (): AspectRatio => {
  return getDefaultAspectRatio()
}

/**
 * 设置用户选择的横竖屏比例（同步更新当前激活图片模型的默认比例）
 * 修改会持久化保存，并与模型配置页面的"默认比例"保持一致
 */
export const setUserAspectRatio = (ratio: AspectRatio): void => {
  const activeModel = getActiveImageModel()
  if (activeModel) {
    updateModel(activeModel.id, {
      params: { ...activeModel.params, defaultAspectRatio: ratio }
    })
  }
}

/**
 * 获取默认视频时长
 */
export const getDefaultVideoDuration = (): VideoDuration => {
  const videoModel = getActiveVideoModel()
  if (videoModel) {
    return videoModel.params.defaultDuration
  }
  return 8
}

/**
 * 获取视频模型类型
 */
export const getVideoModelType = (): 'sora' | 'veo' => {
  const videoModel = getActiveVideoModel()
  if (videoModel) {
    return videoModel.params.mode === 'async' ? 'sora' : 'veo'
  }
  return 'sora'
}
