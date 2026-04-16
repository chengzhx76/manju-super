import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import MentionList from './MentionList'

export interface MentionItem {
  id: string
  type: 'character' | 'scene' | 'prop'
  name: string
  desc: string
  image?: string
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

export function buildProjectLibraryMentionItems(
  projectLibrary: any,
  query = ''
): MentionItem[] {
  const allCharacters = projectLibrary?.characterLibrary || []
  const allScenes = projectLibrary?.sceneLibrary || []
  const allProps = projectLibrary?.propLibrary || []
  const resources: MentionItem[] = [
    ...allCharacters.map((c: any) => ({
      id: c.id || c.name,
      type: 'character' as const,
      name: c.name,
      desc: '基础形象-基础形象',
      image: c.referenceImage
    })),
    ...allScenes.map((s: any) => ({
      id: s.id || s.location,
      type: 'scene' as const,
      name: s.location,
      desc: `${s.location}_0`,
      image: s.referenceImage
    })),
    ...allProps.map((p: any) => ({
      id: p.id || p.name,
      type: 'prop' as const,
      name: p.name,
      desc: p.category || '道具',
      image: p.referenceImage
    }))
  ]

  const normalizedQuery = (query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return dedupeMentionItems(resources).slice(0, 80)
  }

  return dedupeMentionItems(resources)
    .filter((item) => (item.name || '').toLowerCase().includes(normalizedQuery))
    .slice(0, 80)
}

export function buildMentionItems(project: any, query = ''): MentionItem[] {
  const allCharacters = project?.scriptData?.characters || []
  const allScenes = project?.scriptData?.scenes || []
  const allProps = project?.scriptData?.props || []
  const resources: MentionItem[] = [
    ...allCharacters.map((c: any) => ({
      id: c.id || c.name,
      type: 'character' as const,
      name: c.name,
      desc: '基础形象-基础形象',
      image: c.referenceImage
    })),
    ...allScenes.map((s: any) => ({
      id: s.id || s.location,
      type: 'scene' as const,
      name: s.location,
      desc: `${s.location}_0`,
      image: s.referenceImage
    })),
    ...allProps.map((p: any) => ({
      id: p.id || p.name,
      type: 'prop' as const,
      name: p.name,
      desc: p.category || '道具',
      image: p.referenceImage
    }))
  ]

  const normalizedQuery = (query || '').trim().toLowerCase()
  if (!normalizedQuery) {
    return dedupeMentionItems(resources).slice(0, 80)
  }

  return dedupeMentionItems(resources)
    .filter((item) => (item.name || '').toLowerCase().includes(normalizedQuery))
    .slice(0, 80)
}

export default function getSuggestion(
  getProject: () => any,
  getProjectLibrary?: () => any
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
        onStart: (props: any) => {
          const libraryItems = buildProjectLibraryMentionItems(
            getProjectLibrary?.(),
            ''
          )
          component = new ReactRenderer(MentionList, {
            props: {
              ...props,
              libraryItems,
              onAddFromLibrary: createAddFromLibraryHandler()
            },
            editor: props.editor
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
        onUpdate(props: any) {
          const libraryItems = buildProjectLibraryMentionItems(
            getProjectLibrary?.(),
            ''
          )
          component.updateProps({
            ...props,
            libraryItems,
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

        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }

          return (component.ref as any)?.onKeyDown(props)
        },

        onExit() {
          popup?.[0]?.destroy()
          component?.destroy()
        }
      }
    }
  }
}
