import {
  AspectRatio,
  ImageApiFormat,
  ImageModelDefinition
} from '../types/model'

const DEFAULT_GEMINI_IMAGE_ENDPOINT_TEMPLATE =
  '/v1beta/models/{model}:generateContent'
const DEFAULT_OPENAI_IMAGE_ENDPOINT = '/v1/images/generations'

export const getImageApiFormat = (
  model?: Partial<ImageModelDefinition> | null
): ImageApiFormat => {
  const explicitFormat = model?.params?.apiFormat
  if (explicitFormat === 'gemini' || explicitFormat === 'openai') {
    return explicitFormat
  }

  const endpoint = (model?.endpoint || '').toLowerCase()
  if (
    endpoint.includes('/images/generations') ||
    endpoint.includes('/images/edits')
  ) {
    return 'openai'
  }

  const identity =
    `${model?.id || ''} ${model?.apiModel || ''} ${model?.name || ''}`.toLowerCase()
  if (identity.includes('gpt-image')) {
    return 'openai'
  }

  return 'gemini'
}

export const getDefaultImageEndpoint = (
  apiFormat: ImageApiFormat,
  apiModel: string
): string => {
  if (apiFormat === 'openai') {
    return DEFAULT_OPENAI_IMAGE_ENDPOINT
  }

  return DEFAULT_GEMINI_IMAGE_ENDPOINT_TEMPLATE.replace('{model}', apiModel)
}

export const resolveOpenAiImageEndpoint = (
  endpoint: string | undefined,
  hasReferenceImages: boolean,
  preferConfiguredEndpoint: boolean = false
): string => {
  const normalized =
    (endpoint || DEFAULT_OPENAI_IMAGE_ENDPOINT).trim() ||
    DEFAULT_OPENAI_IMAGE_ENDPOINT
  if (preferConfiguredEndpoint) {
    return normalized
  }
  if (!hasReferenceImages) {
    return normalized
  }

  if (normalized.includes('/images/edits')) {
    return normalized
  }

  if (normalized.includes('/images/generations')) {
    return normalized.replace('/images/generations', '/images/edits')
  }

  return normalized
}

const isVolcSeedreamHighMinPixelModel = (apiModel: string): boolean => {
  const normalized = (apiModel || '').toLowerCase()
  return (
    normalized.includes('seedream-5') ||
    normalized.includes('seedream_5') ||
    normalized.includes('seedream5') ||
    normalized.includes('seedream-4.5') ||
    normalized.includes('seedream_4.5') ||
    normalized.includes('seedream-4-5') ||
    normalized.includes('seedream_4_5') ||
    normalized.includes('seedream45')
  )
}

export const mapAspectRatioToOpenAiImageSize = (
  aspectRatio: AspectRatio,
  apiModel?: string
): string => {
  if (isVolcSeedreamHighMinPixelModel(apiModel || '')) {
    switch (aspectRatio) {
      case '9:16':
        return '1600x2848'
      case '1:1':
        return '2048x2048'
      case '16:9':
      default:
        return '2848x1600'
    }
  }

  switch (aspectRatio) {
    case '9:16':
      return '1024x1536'
    case '1:1':
      return '1024x1024'
    case '16:9':
    default:
      return '1536x1024'
  }
}
