import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import MentionList from './MentionList'
import { resolveTosPublicUrlFromAssetId } from '../../../services/assetRelayService'
import type {
  Character,
  CharacterVariation,
  MediaAsset,
  ProjectState,
  SeriesProject
} from '@/types'

export interface MentionItem {
  id: string
  type: 'character' | 'scene' | 'prop' | 'image' | 'video' | 'audio'
  name: string
  desc: string
  assetId?: string
  image?: string
  url?: string
  variantName?: string
  variants?: Array<{
    id: string
    name: string
    desc: string
    assetId?: string
    image?: string
  }>
}

interface MentionListRef {
  onKeyDown?: (payload: { event: KeyboardEvent }) => boolean
}

interface SuggestionPropsLike {
  editor?: unknown
  clientRect?: (() => DOMRect | ClientRect) | null
  event?: KeyboardEvent
}

type MentionMediaLike = Partial<MediaAsset> & {
  assetId?: string
}

const normalizeMediaType = (value: unknown): 'image' | 'video' | 'audio' => {
  const normalized = String(value || 'image')
    .trim()
    .toLowerCase()
  if (normalized === 'video') return 'video'
  if (normalized === 'audio') return 'audio'
  return 'image'
}

const normalizeRemoteUrl = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/^[`'"\s]+|[`'"\s]+$/g, '')
    .trim()

const resolveMediaRemoteUrl = (media: MentionMediaLike): string => {
  const directRemote = normalizeRemoteUrl(media?.remoteUrl)
  if (directRemote) return directRemote
  const tosRemote = normalizeRemoteUrl(
    resolveTosPublicUrlFromAssetId(
      String(media?.tosAssetId || media?.assetId || '').trim()
    )
  )
  return tosRemote
}

const resolveMediaPreviewUrl = (media: MentionMediaLike): string => {
  return String(resolveMediaRemoteUrl(media) || media?.dataUrl || '').trim()
}

const resolveMediaResourceUrl = (media: MentionMediaLike): string => {
  return resolveMediaPreviewUrl(media)
}

const dedupeMentionItems = (items: MentionItem[]): MentionItem[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.type}:${item.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const filterMentionItemsWithImage = (items: MentionItem[]): MentionItem[] => {
  return items.filter((item) => String(item?.image || '').trim().length > 0)
}

const toCharacterVariants = (character: Character): MentionItem['variants'] => {
  const baseDesc = String(character?.visualPrompt || '').trim() || '基础形象'
  const baseVariant = {
    id: `${character?.id || character?.name || 'character'}::base`,
    name: '基础形象',
    desc: baseDesc,
    assetId: character?.assetId || '',
    image: character?.referenceImage
  }
  const derivedVariants = (character?.variations || [])
    .map((variation: CharacterVariation, index: number) => {
      const variantName =
        String(variation?.name || '').trim() || `变体形象${index + 1}`
      const variantDesc =
        String(variation?.visualPrompt || '').trim() || `${variantName}描述`
      return {
        id:
          String(variation?.id || '').trim() ||
          `${character?.id || character?.name || 'character'}::variation-${index + 1}`,
        name: variantName,
        desc: variantDesc,
        assetId: variation?.assetId || character?.assetId || '',
        image: variation?.referenceImage || character?.referenceImage
      }
    })
    .filter((item) => item.name)
  return [baseVariant, ...derivedVariants]
}

export function buildProjectLibraryMentionItems(
  projectLibrary: SeriesProject | null | undefined,
  query = ''
): MentionItem[] {
  const allCharacters = projectLibrary?.characterLibrary || []
  const allScenes = projectLibrary?.sceneLibrary || []
  const allProps = projectLibrary?.propLibrary || []
  const resources: MentionItem[] = [
    ...allCharacters.map((c) => ({
      id: c.id || c.name,
      type: 'character' as const,
      name: c.name,
      desc: '基础形象-基础形象',
      assetId: c.assetId || '',
      image: c.referenceImage,
      variants: toCharacterVariants(c)
    })),
    ...allScenes.map((s) => ({
      id: s.id || s.location,
      type: 'scene' as const,
      name: s.location,
      desc: `${s.location}_0`,
      assetId: s.assetId || '',
      image: s.referenceImage
    })),
    ...allProps.map((p) => ({
      id: p.id || p.name,
      type: 'prop' as const,
      name: p.name,
      desc: p.category || '道具',
      assetId: p.assetId || '',
      image: p.referenceImage
    }))
  ]
  const resourcesWithImage = filterMentionItemsWithImage(resources)

  const normalizedQuery = (query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return dedupeMentionItems(resourcesWithImage).slice(0, 80)
  }

  return dedupeMentionItems(resourcesWithImage)
    .filter((item) => (item.name || '').toLowerCase().includes(normalizedQuery))
    .slice(0, 80)
}

export function buildMentionItems(
  project: ProjectState | null | undefined,
  query = ''
): MentionItem[] {
  const allCharacters = project?.scriptData?.characters || []
  const allScenes = project?.scriptData?.scenes || []
  const allProps = project?.scriptData?.props || []
  const allMediaAssets = project?.scriptData?.mediaAssets || []
  const mediaTypeLabelMap = {
    image: '图片素材',
    video: '视频素材',
    audio: '音频素材'
  } as const
  const resources: MentionItem[] = [
    ...allCharacters.map((c) => ({
      id: c.id || c.name,
      type: 'character' as const,
      name: c.name,
      desc: '基础形象-基础形象',
      assetId: c.assetId || '',
      image: c.referenceImage,
      variants: toCharacterVariants(c)
    })),
    ...allScenes.map((s) => ({
      id: s.id || s.location,
      type: 'scene' as const,
      name: s.location,
      desc: `${s.location}_0`,
      assetId: s.assetId || '',
      image: s.referenceImage
    })),
    ...allProps.map((p) => ({
      id: p.id || p.name,
      type: 'prop' as const,
      name: p.name,
      desc: p.category || '道具',
      assetId: p.assetId || '',
      image: p.referenceImage
    })),
    ...allMediaAssets.map((m) => {
      const mediaType = normalizeMediaType(m.type)
      return {
        id: m.id || m.name,
        type: mediaType,
        name: m.name,
        assetId: m.relayAssetId || '',
        url: resolveMediaResourceUrl(m),
        image: mediaType === 'image' ? resolveMediaPreviewUrl(m) : undefined,
        desc: mediaTypeLabelMap[mediaType] || '媒体素材'
      }
    })
  ]
  const resourcesWithImage = filterMentionItemsWithImage(resources)

  const normalizedQuery = (query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return dedupeMentionItems(resourcesWithImage).slice(0, 80)
  }

  return dedupeMentionItems(resourcesWithImage)
    .filter((item) => (item.name || '').toLowerCase().includes(normalizedQuery))
    .slice(0, 80)
}

export default function getSuggestion(
  getProject: () => ProjectState | null | undefined,
  getProjectLibrary?: () => SeriesProject | null | undefined
) {
  return {
    char: '@',
    items: ({ query }: { query: string }) => {
      const scriptItems = buildMentionItems(getProject(), query)
      const libraryItems = buildProjectLibraryMentionItems(
        getProjectLibrary?.(),
        query
      )
      return dedupeMentionItems([...scriptItems, ...libraryItems]).slice(0, 80)
    },

    render: () => {
      let component: ReactRenderer
      let popup: Instance[]
      const createAddFromLibraryHandler = () => () => {}

      return {
        onStart: (props: SuggestionPropsLike) => {
          const libraryItems = buildProjectLibraryMentionItems(
            getProjectLibrary?.(),
            ''
          )
          component = new ReactRenderer(MentionList, {
            props: {
              ...props,
              libraryItems,
              allowDurationAction: true,
              onAddFromLibrary: createAddFromLibraryHandler()
            },
            editor: props.editor as never
          })

          if (!props.clientRect) {
            return
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'mention-picker',
            arrow: false,
            maxWidth: 'none'
          })
        },
        onUpdate(props: SuggestionPropsLike) {
          const libraryItems = buildProjectLibraryMentionItems(
            getProjectLibrary?.(),
            ''
          )
          component.updateProps({
            ...props,
            libraryItems,
            allowDurationAction: true,
            onAddFromLibrary: createAddFromLibraryHandler()
          })

          if (!props.clientRect) {
            return
          }

          if (!popup) {
            popup = tippy('body', {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
              theme: 'mention-picker',
              arrow: false,
              maxWidth: 'none'
            })
          } else if (popup[0]) {
            popup[0].setProps({
              getReferenceClientRect: props.clientRect
            })
          }
        },

        onKeyDown(props: SuggestionPropsLike) {
          if (props.event?.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }

          if (!props.event) {
            return false
          }

          return (
            (component.ref as MentionListRef | null)?.onKeyDown?.({
              event: props.event
            }) || false
          )
        },

        onExit() {
          popup?.[0]?.destroy()
          component?.destroy()
        }
      }
    }
  }
}
