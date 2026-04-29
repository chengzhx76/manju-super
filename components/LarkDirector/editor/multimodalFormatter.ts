import { Character, MediaAsset, ProjectState, Prop, Scene } from '../../../types'
import { resolveTosPublicUrlFromAssetId } from '../../../services/assetRelayService'

export interface MentionItemData {
  id?: string
  name?: string
  type?: string
  variantName?: string
  image?: string
  url?: string
  remoteUrl?: string
  dataUrl?: string
  assetId?: string
}

export interface MentionNodeAttrs {
  id?: string
  label?: string
  value?: number
  itemData?: MentionItemData | null
}

export interface RichDocNode {
  type?: string
  text?: string
  attrs?: MentionNodeAttrs
  content?: RichDocNode[]
}

export interface RichDocRoot {
  content?: RichDocNode[]
}

export type ReferenceMediaType = 'image' | 'video' | 'audio'

export type MultimodalResourceReference = {
  mediaType: ReferenceMediaType
  id: string
  name: string
  url: string
  assetId?: string
}

export type MultimodalFormatOutput = {
  storyboardText: string
  resourceReferences: {
    images: Array<{ id: string; name: string; url: string; assetId?: string }>
    videos: Array<{ id: string; name: string; url: string; assetId?: string }>
    audios: Array<{ id: string; name: string; url: string; assetId?: string }>
    ordered: MultimodalResourceReference[]
  }
}

export type MultimodalContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string }; role: 'reference_image' }
  | { type: 'video_url'; video_url: { url: string }; role: 'reference_video' }
  | { type: 'audio_url'; audio_url: { url: string }; role: 'reference_audio' }

export const parseRichDocFromHtml = (html: string): RichDocRoot => {
  const htmlText = String(html || '').trim()
  if (!htmlText) return { content: [] }
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlText, 'text/html')
  const parseMentionItemData = (raw: string): MentionItemData | null => {
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed as MentionItemData
      }
      return null
    } catch {
      return null
    }
  }

  const walkNodes = (nodes: NodeListOf<ChildNode> | ChildNode[]): RichDocNode[] => {
    return Array.from(nodes)
      .map((node) => {
        if (node.nodeType === 3) {
          const text = String(node.textContent || '')
          if (!text) return null
          return { type: 'text', text } as RichDocNode
        }
        if (node.nodeType !== 1) return null
        const element = node as Element
        const tagName = element.tagName.toLowerCase()
        if (tagName === 'br') return { type: 'hardBreak' } as RichDocNode

        if (element.hasAttribute('data-duration-tag')) {
          const rawValue = String(
            element.getAttribute('data-value') || element.getAttribute('value') || ''
          ).trim()
          const parsedValue = Number.parseFloat(rawValue)
          return {
            type: 'durationTag',
            attrs: {
              value: Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 5
            }
          } as RichDocNode
        }

        const dataType = String(element.getAttribute('data-type') || '').trim()
        if (dataType === 'mention') {
          const itemDataRaw = String(element.getAttribute('data-item') || '').trim()
          const itemData = parseMentionItemData(itemDataRaw)
          const label = String(
            element.getAttribute('data-label') ||
              itemData?.name ||
              element.textContent ||
              ''
          )
            .replace(/^@/, '')
            .trim()
          return {
            type: 'mention',
            attrs: {
              id: String(
                element.getAttribute('data-id') || itemData?.id || label || ''
              ).trim(),
              label,
              itemData
            }
          } as RichDocNode
        }

        const childNodes = walkNodes(element.childNodes)
        if (childNodes.length === 0) return null
        return {
          type: tagName === 'p' ? 'paragraph' : tagName,
          content: childNodes
        } as RichDocNode
      })
      .filter((item): item is RichDocNode => Boolean(item))
  }

  return {
    content: walkNodes(doc.body.childNodes)
  }
}

export const formatEditorConsoleOutput = (
  project: ProjectState | null | undefined,
  docJson: RichDocRoot | null | undefined,
  fallbackText: string
): MultimodalFormatOutput => {
  let startSec = 0
  const formatSec = (value: number): string =>
    Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
  const normalizeLine = (value: string): string =>
    value
      .replace(/[^\S\r\n]+/g, ' ')
      .replace(/\s*([，。！？：；,.!?;:])/g, '$1')
      .trim()
  const scriptData = project?.scriptData
  const allCharacters: Character[] = Array.isArray(scriptData?.characters)
    ? scriptData.characters
    : []
  const allScenes: Scene[] = Array.isArray(scriptData?.scenes) ? scriptData.scenes : []
  const allProps: Prop[] = Array.isArray(scriptData?.props) ? scriptData.props : []
  const allMediaAssets: MediaAsset[] = Array.isArray(scriptData?.mediaAssets)
    ? scriptData.mediaAssets
    : []

  const resourceReferences = {
    images: [] as Array<{ id: string; name: string; url: string; assetId?: string }>,
    videos: [] as Array<{ id: string; name: string; url: string; assetId?: string }>,
    audios: [] as Array<{ id: string; name: string; url: string; assetId?: string }>,
    ordered: [] as MultimodalResourceReference[]
  }

  const normalizeMediaType = (value: unknown): ReferenceMediaType => {
    const normalized = String(value || 'image')
      .trim()
      .toLowerCase()
    if (normalized === 'video') return 'video'
    if (normalized === 'audio') return 'audio'
    return 'image'
  }
  const normalizeUrl = (value: unknown): string =>
    String(value || '')
      .trim()
      .replace(/^[`'"\s]+|[`'"\s]+$/g, '')
      .trim()
  const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const resolveMediaAssetUrl = (asset?: MediaAsset | null): string => {
    if (!asset) return ''
    const directUrl = normalizeUrl(asset.remoteUrl || asset.dataUrl)
    if (directUrl) return directUrl
    return normalizeUrl(resolveTosPublicUrlFromAssetId(asset.tosAssetId))
  }
  const referenceIndexMap = new Map<string, number>()
  const buildReferenceKeys = (payload: {
    mediaType: ReferenceMediaType
    id: string
    name: string
    url: string
    assetId?: string
  }): string[] => {
    const mediaType = payload.mediaType
    const normalizedName = String(payload.name || '').trim()
    const normalizedId = String(payload.id || '').trim()
    const normalizedUrl = String(payload.url || '').trim()
    const normalizedAssetId = String(payload.assetId || '').trim()
    const keys: string[] = []
    if (normalizedUrl) keys.push(`${mediaType}:url:${normalizedUrl}`)
    if (normalizedAssetId) keys.push(`${mediaType}:asset:${normalizedAssetId}`)
    if (normalizedId) keys.push(`${mediaType}:id:${normalizedId}`)
    if (normalizedName) keys.push(`${mediaType}:name:${normalizedName}`)
    return keys
  }
  const pushReference = (payload: {
    mediaType: ReferenceMediaType
    id: string
    name: string
    url: string
    assetId?: string
  }): null | { mediaType: ReferenceMediaType; index: number } => {
    const normalizedName = String(payload.name || '').trim()
    if (!normalizedName) return null
    const normalizedPayload = {
      id: String(payload.id || normalizedName).trim() || normalizedName,
      name: normalizedName,
      url: String(payload.url || '').trim(),
      assetId: String(payload.assetId || '').trim() || undefined
    }
    const keys = buildReferenceKeys({ ...payload, ...normalizedPayload })
    const findOrderedReferenceByTypedIndex = (
      mediaType: ReferenceMediaType,
      typedIndex: number
    ): MultimodalResourceReference | undefined => {
      if (typedIndex <= 0) return undefined
      let currentTypedIndex = 0
      for (const item of resourceReferences.ordered) {
        if (item.mediaType !== mediaType) continue
        currentTypedIndex += 1
        if (currentTypedIndex === typedIndex) return item
      }
      return undefined
    }
    const getTypedCollection = (
      mediaType: ReferenceMediaType
    ): Array<{ id: string; name: string; url: string; assetId?: string }> => {
      if (mediaType === 'video') return resourceReferences.videos
      if (mediaType === 'audio') return resourceReferences.audios
      return resourceReferences.images
    }
    for (const key of keys) {
      const existedIndex = referenceIndexMap.get(key)
      if (typeof existedIndex === 'number') {
        if (normalizedPayload.assetId) {
          const typedCollection = getTypedCollection(payload.mediaType)
          const typedReference = typedCollection[existedIndex - 1]
          if (typedReference && !typedReference.assetId) {
            typedReference.assetId = normalizedPayload.assetId
          }
          const orderedReference = findOrderedReferenceByTypedIndex(
            payload.mediaType,
            existedIndex
          )
          if (orderedReference && !orderedReference.assetId) {
            orderedReference.assetId = normalizedPayload.assetId
          }
          referenceIndexMap.set(
            `${payload.mediaType}:asset:${normalizedPayload.assetId}`,
            existedIndex
          )
        }
        return { mediaType: payload.mediaType, index: existedIndex }
      }
    }

    if (payload.mediaType === 'video') {
      resourceReferences.videos.push(normalizedPayload)
    } else if (payload.mediaType === 'audio') {
      resourceReferences.audios.push(normalizedPayload)
    } else {
      resourceReferences.images.push(normalizedPayload)
    }
    resourceReferences.ordered.push({
      mediaType: payload.mediaType,
      ...normalizedPayload
    })
    const index =
      payload.mediaType === 'video'
        ? resourceReferences.videos.length
        : payload.mediaType === 'audio'
          ? resourceReferences.audios.length
          : resourceReferences.images.length
    keys.forEach((key) => referenceIndexMap.set(key, index))
    return { mediaType: payload.mediaType, index }
  }
  const pushResolvedReference = (payload: {
    mediaType: ReferenceMediaType
    id: string
    name: string
    url: string
    assetId?: string
  }): void => {
    const normalizedUrl = String(payload.url || '').trim()
    if (!normalizedUrl) return
    pushReference({
      ...payload,
      url: normalizedUrl
    })
  }

  const mediaTagLabelMap = {
    image: '图',
    video: '视频',
    audio: '音频'
  } as const

  const resolveMentionMediaType = (mentionType: string): ReferenceMediaType => {
    if (mentionType === 'video') return 'video'
    if (mentionType === 'audio') return 'audio'
    return 'image'
  }

  const getMentionDisplayName = (attrs?: MentionNodeAttrs): string => {
    const itemData = attrs?.itemData
    const mentionType = String(itemData?.type || '').trim()
    const baseName = String(itemData?.name || attrs?.label || attrs?.id || '').trim()
    if (!baseName) return ''
    if (mentionType === 'character') {
      const variantName = String(itemData?.variantName || '').trim()
      return variantName ? `@${baseName}-${variantName}` : `@${baseName}`
    }
    return `@${baseName}`
  }

  const resolveMentionResourceUrl = (attrs?: MentionNodeAttrs): string => {
    const itemData = attrs?.itemData
    const mentionType = String(itemData?.type || '').trim()
    const itemId = String(itemData?.id || '').trim()
    const itemName = String(itemData?.name || attrs?.label || attrs?.id || '').trim()
    const directUrl = String(
      itemData?.url || itemData?.image || itemData?.remoteUrl || itemData?.dataUrl || ''
    ).trim()
    if (directUrl) return directUrl

    if (mentionType === 'video' || mentionType === 'audio' || mentionType === 'image') {
      const media = allMediaAssets.find((asset) => {
        const assetId = String(asset?.id || '').trim()
        const assetName = String(asset?.name || '').trim()
        return (itemId && assetId === itemId) || (itemName && assetName === itemName)
      })
      return resolveMediaAssetUrl(media)
    }

    if (mentionType === 'character') {
      const baseCharacterId = itemId.split('::')[0]
      const baseName = String(itemData?.name || '').trim()
      const variantName = String(itemData?.variantName || '').trim()
      const variationId = itemId.includes('::') ? itemId.split('::')[1] : ''
      const character = allCharacters.find((char) => {
        const charId = String(char?.id || '').trim()
        const charName = String(char?.name || '').trim()
        return (
          (baseCharacterId && charId === baseCharacterId) ||
          (itemId && charId === itemId) ||
          (baseName && charName === baseName) ||
          (itemName && charName === itemName)
        )
      })
      if (!character) return ''
      if (variantName || variationId) {
        const variation = (character?.variations || []).find((variationItem) => {
          const id = String(variationItem?.id || '').trim()
          const name = String(variationItem?.name || '').trim()
          return (variationId && id === variationId) || (variantName && name === variantName)
        })
        const variationUrl = String(variation?.referenceImage || '').trim()
        if (variationUrl) return variationUrl
      }
      return String(character?.referenceImage || '').trim()
    }

    if (mentionType === 'scene') {
      const scene = allScenes.find((item) => {
        const id = String(item?.id || '').trim()
        const name = String(item?.location || '').trim()
        return (itemId && id === itemId) || (itemName && name === itemName)
      })
      return String(scene?.referenceImage || '').trim()
    }

    if (mentionType === 'prop') {
      const prop = allProps.find((item) => {
        const id = String(item?.id || '').trim()
        const name = String(item?.name || '').trim()
        return (itemId && id === itemId) || (itemName && name === itemName)
      })
      return String(prop?.referenceImage || '').trim()
    }

    return ''
  }

  const resolveMentionAssetId = (attrs?: MentionNodeAttrs): string => {
    const isAssetIdBoundToUrl = (assetId: string, targetUrl: string): boolean => {
      const normalizedAssetId = String(assetId || '').trim()
      const normalizedTargetUrl = normalizeUrl(targetUrl)
      if (!normalizedAssetId || !normalizedTargetUrl) return false
      const resolvedUrl = normalizeUrl(resolveTosPublicUrlFromAssetId(normalizedAssetId))
      if (!resolvedUrl) return false
      return resolvedUrl.split('?')[0] === normalizedTargetUrl.split('?')[0]
    }
    const itemData = attrs?.itemData
    const mentionType = String(itemData?.type || '').trim()
    const itemId = String(itemData?.id || attrs?.id || '').trim()
    const itemName = String(itemData?.name || attrs?.label || attrs?.id || '').trim()
    const directAssetId = String(itemData?.assetId || '').trim()

    if (mentionType === 'video' || mentionType === 'audio' || mentionType === 'image') {
      const media = allMediaAssets.find((asset) => {
        const assetId = String(asset?.id || '').trim()
        const assetName = String(asset?.name || '').trim()
        return (itemId && assetId === itemId) || (itemName && assetName === itemName)
      })
      return String(media?.relayAssetId || '').trim()
    }

    if (mentionType === 'character') {
      const baseCharacterId = itemId.split('::')[0]
      const baseName = String(itemData?.name || '').trim()
      const variantName = String(itemData?.variantName || '').trim()
      const variationId = itemId.includes('::') ? itemId.split('::')[1] : ''
      const character = allCharacters.find((char) => {
        const charId = String(char?.id || '').trim()
        const charName = String(char?.name || '').trim()
        return (
          (baseCharacterId && charId === baseCharacterId) ||
          (itemId && charId === itemId) ||
          (baseName && charName === baseName) ||
          (itemName && charName === itemName)
        )
      })
      if (!character) return directAssetId

      let activeImageUrl = String(character.referenceImage || '').trim()
      let activeAssetId = String(character.assetId || '').trim()

      if (variantName || variationId) {
        const variation = (character.variations || []).find((variationItem) => {
          const id = String(variationItem?.id || '').trim()
          const name = String(variationItem?.name || '').trim()
          return (variationId && id === variationId) || (variantName && name === variantName)
        })
        if (variation) {
          const variationUrl = String(variation.referenceImage || '').trim()
          if (variationUrl) activeImageUrl = variationUrl
          const variationAssetId = String(variation.assetId || '').trim()
          if (variationAssetId) {
            activeAssetId = variationAssetId
          }
        }
      }

      const historyAssetId = (character.generationHistory || [])
        .find(
          (item) =>
            normalizeUrl(item.imageUrl) === normalizeUrl(activeImageUrl) &&
            String(item.assetId || '').trim()
        )
        ?.assetId
      const boundActiveAssetId = isAssetIdBoundToUrl(activeAssetId, activeImageUrl)
        ? activeAssetId
        : ''
      return String(historyAssetId || boundActiveAssetId || directAssetId || '').trim()
    }

    if (mentionType === 'scene') {
      const scene = allScenes.find((item) => {
        const id = String(item?.id || '').trim()
        const name = String(item?.location || '').trim()
        return (itemId && id === itemId) || (itemName && name === itemName)
      })
      if (!scene) return directAssetId
      const historyAssetId = (scene.generationHistory || [])
        .find(
          (item) =>
            normalizeUrl(item.imageUrl) === normalizeUrl(scene.referenceImage) &&
            String(item.assetId || '').trim()
        )
        ?.assetId
      const sceneAssetId = String(scene.assetId || '').trim()
      const boundSceneAssetId = isAssetIdBoundToUrl(
        sceneAssetId,
        String(scene.referenceImage || '')
      )
        ? sceneAssetId
        : ''
      const boundDirectSceneAssetId = isAssetIdBoundToUrl(
        directAssetId,
        String(scene.referenceImage || '')
      )
        ? directAssetId
        : ''
      return String(historyAssetId || boundSceneAssetId || boundDirectSceneAssetId || '').trim()
    }

    if (mentionType === 'prop') {
      const prop = allProps.find((item) => {
        const id = String(item?.id || '').trim()
        const name = String(item?.name || '').trim()
        return (itemId && id === itemId) || (itemName && name === itemName)
      })
      if (!prop) return directAssetId
      const historyAssetId = (prop.generationHistory || [])
        .find(
          (item) =>
            normalizeUrl(item.imageUrl) === normalizeUrl(prop.referenceImage) &&
            String(item.assetId || '').trim()
        )
        ?.assetId
      const propAssetId = String(prop.assetId || '').trim()
      const boundPropAssetId = isAssetIdBoundToUrl(
        propAssetId,
        String(prop.referenceImage || '')
      )
        ? propAssetId
        : ''
      const boundDirectPropAssetId = isAssetIdBoundToUrl(
        directAssetId,
        String(prop.referenceImage || '')
      )
        ? directAssetId
        : ''
      return String(historyAssetId || boundPropAssetId || boundDirectPropAssetId || '').trim()
    }

    return directAssetId
  }

  const pushResourceReference = (
    attrs?: MentionNodeAttrs
  ): null | { mediaType: ReferenceMediaType; index: number } => {
    const itemData = attrs?.itemData
    const mentionType = String(itemData?.type || '').trim()
    const mediaType = resolveMentionMediaType(mentionType)
    if (
      !['character', 'scene', 'prop', 'image', 'video', 'audio'].includes(mentionType)
    ) {
      return null
    }
    const resourceId = String(itemData?.id || attrs?.id || '').trim()
    const resourceName = getMentionDisplayName(attrs).replace(/^@/, '')
    if (!resourceName) return null
    const resourceUrl = resolveMentionResourceUrl(attrs)
    const resourceAssetId = resolveMentionAssetId(attrs)
    return pushReference({
      mediaType,
      id: resourceId,
      name: resourceName,
      url: resourceUrl,
      assetId: resourceAssetId
    })
  }

  const toMentionText = (attrs?: MentionNodeAttrs): string => {
    return getMentionDisplayName(attrs)
  }

  const resolveInlineAtReferences = (storyText: string): string => {
    const tokenMatches = Array.from(storyText.matchAll(/@([^\s@，。！？：；,.!?;:()（）]+)/g))
    const tokenNames = tokenMatches
      .map((match) => String(match[1] || '').trim())
      .filter((name) => name.length > 0)
    if (tokenNames.length === 0) return storyText

    let nextStoryText = storyText
    const replaceToken = (
      tokenName: string,
      inserted: { mediaType: ReferenceMediaType; index: number } | null
    ): void => {
      if (!inserted) return
      const tokenPattern = new RegExp(
        `@${escapeRegExp(tokenName)}(?=[\\s@，。！？：；,.!?;:()（）]|$)`,
        'g'
      )
      nextStoryText = nextStoryText.replace(
        tokenPattern,
        `@${mediaTagLabelMap[inserted.mediaType]}${inserted.index}`
      )
    }

    tokenNames.forEach((tokenName) => {
      const media = allMediaAssets.find(
        (asset) => String(asset?.name || '').trim() === tokenName
      )
      if (media) {
        const mediaType = normalizeMediaType(media.type)
        replaceToken(
          tokenName,
          pushReference({
            mediaType,
            id: String(media.id || tokenName).trim() || tokenName,
            name: tokenName,
            url: resolveMediaAssetUrl(media),
            assetId: String(media.relayAssetId || '').trim()
          })
        )
        return
      }

      const character = allCharacters.find(
        (item) => String(item?.name || '').trim() === tokenName
      )
      if (character) {
        replaceToken(
          tokenName,
          pushReference({
            mediaType: 'image',
            id: String(character.id || tokenName).trim() || tokenName,
            name: tokenName,
            url: String(character.referenceImage || '').trim(),
            assetId: String(character.assetId || '').trim()
          })
        )
        return
      }

      const scene = allScenes.find((item) => String(item?.location || '').trim() === tokenName)
      if (scene) {
        replaceToken(
          tokenName,
          pushReference({
            mediaType: 'image',
            id: String(scene.id || tokenName).trim() || tokenName,
            name: tokenName,
            url: String(scene.referenceImage || '').trim(),
            assetId: String(scene.assetId || '').trim()
          })
        )
        return
      }

      const prop = allProps.find((item) => String(item?.name || '').trim() === tokenName)
      if (prop) {
        replaceToken(
          tokenName,
          pushReference({
            mediaType: 'image',
            id: String(prop.id || tokenName).trim() || tokenName,
            name: tokenName,
            url: String(prop.referenceImage || '').trim(),
            assetId: String(prop.assetId || '').trim()
          })
        )
      }
    })

    return nextStoryText
  }

  const resolveFallbackResourcesOnly = (storyText: string): void => {
    const tokenMatches = Array.from(storyText.matchAll(/@([^\s@，。！？：；,.!?;:()（）]+)/g))
    const tokenNames = tokenMatches
      .map((match) => String(match[1] || '').trim())
      .filter((name) => name.length > 0)
    if (tokenNames.length === 0) return

    tokenNames.forEach((tokenName) => {
      const media = allMediaAssets.find(
        (asset) => String(asset?.name || '').trim() === tokenName
      )
      if (media) {
        const mediaType = normalizeMediaType(media.type)
        pushResolvedReference({
          mediaType,
          id: String(media.id || tokenName).trim() || tokenName,
          name: tokenName,
          url: resolveMediaAssetUrl(media),
          assetId: String(media.relayAssetId || '').trim()
        })
        return
      }

      const character = allCharacters.find((item) => String(item?.name || '').trim() === tokenName)
      if (character) {
        pushResolvedReference({
          mediaType: 'image',
          id: String(character.id || tokenName).trim() || tokenName,
          name: tokenName,
          url: String(character.referenceImage || '').trim(),
          assetId: String(character.assetId || '').trim()
        })
        return
      }

      const scene = allScenes.find((item) => String(item?.location || '').trim() === tokenName)
      if (scene) {
        pushResolvedReference({
          mediaType: 'image',
          id: String(scene.id || tokenName).trim() || tokenName,
          name: tokenName,
          url: String(scene.referenceImage || '').trim(),
          assetId: String(scene.assetId || '').trim()
        })
        return
      }

      const prop = allProps.find((item) => String(item?.name || '').trim() === tokenName)
      if (prop) {
        pushResolvedReference({
          mediaType: 'image',
          id: String(prop.id || tokenName).trim() || tokenName,
          name: tokenName,
          url: String(prop.referenceImage || '').trim(),
          assetId: String(prop.assetId || '').trim()
        })
      }
    })
  }

  const walkNodes = (nodes: RichDocNode[]): string => {
    if (!Array.isArray(nodes)) return ''
    return nodes
      .map((node) => {
        if (!node || typeof node !== 'object') return ''
        const nodeType = String(node.type || '')
        if (nodeType === 'text') return String(node.text || '')
        if (nodeType === 'hardBreak') return '\n'
        if (nodeType === 'mention') {
          const inserted = pushResourceReference(node.attrs)
          if (!inserted) return toMentionText(node.attrs)
          return `@${mediaTagLabelMap[inserted.mediaType]}${inserted.index}`
        }
        if (nodeType === 'durationTag') {
          const rawDuration = Number.parseFloat(String(node.attrs?.value ?? '5'))
          const durationSec = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 5
          const endSec = startSec + durationSec
          const rangeText = `(${formatSec(startSec)}-${formatSec(endSec)}s)`
          startSec = endSec + 1
          return rangeText
        }
        if (Array.isArray(node.content)) {
          return walkNodes(node.content)
        }
        return ''
      })
      .join('')
  }

  const lines: string[] = []
  const rootNodes = Array.isArray(docJson?.content) ? docJson.content : []
  rootNodes.forEach((node) => {
    const rendered = walkNodes(Array.isArray(node?.content) ? node.content : [node])
    if (!rendered) return
    rendered
      .split('\n')
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 0)
      .forEach((line) => lines.push(line))
  })

  if (lines.length === 0) {
    const fallbackStoryboardText = normalizeLine(fallbackText || '')
    const resolvedStoryboardText = resolveInlineAtReferences(fallbackStoryboardText)
    if (resolvedStoryboardText === fallbackStoryboardText) {
      resolveFallbackResourcesOnly(fallbackStoryboardText)
    }
    return {
      storyboardText: resolvedStoryboardText,
      resourceReferences
    }
  }
  const storyboardText = resolveInlineAtReferences(lines.join('\n'))
  return {
    storyboardText,
    resourceReferences
  }
}

export const buildMultimodalPayload = (
  output: MultimodalFormatOutput
): MultimodalContentItem[] => {
  const resolvePayloadReferenceUrl = (
    item: MultimodalResourceReference
  ): string => {
    const normalizedAssetId = String(item.assetId || '').trim()
    if (normalizedAssetId) return `asset://${normalizedAssetId}`
    return String(item.url || '').trim()
  }

  return [
    {
      type: 'text',
      text: output.storyboardText
    },
    ...output.resourceReferences.ordered
      .filter((item) => Boolean(resolvePayloadReferenceUrl(item)))
      .map((item) => {
        const referenceUrl = resolvePayloadReferenceUrl(item)
        if (item.mediaType === 'video') {
          return {
            type: 'video_url' as const,
            video_url: {
              url: referenceUrl
            },
            role: 'reference_video' as const
          }
        }
        if (item.mediaType === 'audio') {
          return {
            type: 'audio_url' as const,
            audio_url: {
              url: referenceUrl
            },
            role: 'reference_audio' as const
          }
        }
        return {
          type: 'image_url' as const,
          image_url: {
            url: referenceUrl
          },
          role: 'reference_image' as const
        }
      })
  ]
}
