import React, { useCallback, useEffect, useState, useRef } from 'react'
import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  ReactRenderer
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { mergeAttributes, Node } from '@tiptap/core'
import tippy, { Instance } from 'tippy.js'
import getSuggestion, {
  buildMentionItems,
  buildProjectLibraryMentionItems
} from './suggestion'
import MentionList from './MentionList'
import { ProjectState, SeriesProject } from '../../../types'
import { Clock, Edit2, Film } from 'lucide-react'
import {
  buildMultimodalPayload,
  formatEditorConsoleOutput,
  MentionItemData,
  RichDocRoot
} from './multimodalFormatter'

interface DurationTagNodeViewProps {
  node: { attrs: { value?: number } }
  updateAttributes: (attrs: { value: number }) => void
  editor?: { commands: { focus: () => void } }
}

interface MentionCommandPayload {
  id?: string
  label?: string
  name?: string
  type?: string
  value?: number
  itemData?: MentionItemData | null
}

type EditorMultimodalPayload = {
  storyboardText: string
  multimodalPayload: ReturnType<typeof buildMultimodalPayload>
}

const extractDurationValue = (
  selected: MentionItemData | MentionCommandPayload | null | undefined
): number => {
  if (!selected || typeof selected !== 'object') return 5.0
  if ('value' in selected && typeof selected.value === 'number') {
    return selected.value
  }
  return 5.0
}

interface MentionCommandEditor {
  chain: () => {
    focus: () => {
      insertContentAt: (
        range: unknown,
        content: Array<Record<string, unknown>>
      ) => { run: () => void }
    }
  }
}

interface MentionListHandle {
  onKeyDown?: (payload: { event: KeyboardEvent }) => boolean
}

const DurationTagComponent = ({
  node,
  updateAttributes,
  editor
}: DurationTagNodeViewProps) => {
  const formatDurationValue = (value: number): string => {
    return Number.isInteger(value) ? value.toFixed(1) : value.toString()
  }

  const [localValue, setLocalValue] = useState(() => {
    return typeof node.attrs.value === 'number'
      ? formatDurationValue(node.attrs.value)
      : '5.0'
  })

  useEffect(() => {
    if (typeof node.attrs.value !== 'number') return
    const valStr = formatDurationValue(node.attrs.value)
    setLocalValue((prev) => {
      if (prev === '' || prev.endsWith('.')) return prev
      return prev === valStr ? prev : valStr
    })
  }, [node.attrs.value])

  const handleBlur = () => {
    let val = parseFloat(localValue)
    if (isNaN(val)) val = 5.0

    // Ensure it's formatted with at least one decimal place if it's an integer
    const formatted = formatDurationValue(val)
    setLocalValue(formatted)
    updateAttributes({ value: val })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleBlur()
    editor?.commands.focus()
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex h-6 items-center gap-0.5 bg-white border border-gray-200 rounded-full px-1.5 mx-1.5 align-middle shadow-sm text-black"
    >
      <Clock className="w-3 h-3 text-gray-500" />
      <input
        type="number"
        min="0"
        max="15"
        step="0.1"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-5 w-7 text-center bg-transparent border-none outline-none text-[12px] leading-none font-medium p-0 m-0 hide-number-spinners duration-input"
      />
      <span className="text-gray-500 text-[11px] leading-none font-medium pr-0.5">
        s
      </span>
    </NodeViewWrapper>
  )
}

const DurationTag = Node.create({
  name: 'durationTag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      value: {
        default: 5.0
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-duration-tag]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-duration-tag': '' }, HTMLAttributes)
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DurationTagComponent)
  }
})

const CustomMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      itemData: {
        default: null,
        parseHTML: (element) =>
          JSON.parse(element.getAttribute('data-item') || 'null'),
        renderHTML: (attributes) => {
          if (!attributes.itemData) {
            return {}
          }
          return {
            'data-item': JSON.stringify(attributes.itemData)
          }
        }
      }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const item = node.attrs.itemData
    let colorClass = 'bg-gray-400'
    if (item?.name?.includes('泽维尔')) colorClass = 'bg-blue-500'
    else if (item?.name?.includes('塞西莉亚')) colorClass = 'bg-orange-400'
    else if (item?.name?.includes('金发女孩')) colorClass = 'bg-yellow-400'
    else if (item?.name?.includes('办公室')) colorClass = 'bg-blue-400'

    const colorSpan = ['span', { class: `w-2 h-2 rounded-full ${colorClass}` }]
    const mediaIcon =
      item?.type === 'audio'
        ? [
            'span',
            {
              class:
                'w-4 h-4 rounded-full bg-gray-100 border border-gray-200 shrink-0 inline-flex items-center justify-center text-[10px] text-gray-600'
            },
            '♪'
          ]
        : item?.type === 'video'
          ? [
              'span',
              {
                class:
                  'w-4 h-4 rounded-full bg-gray-100 border border-gray-200 shrink-0 inline-flex items-center justify-center text-[10px] text-gray-600'
              },
              '▶'
            ]
          : item?.type === 'image'
            ? [
                'span',
                {
                  class:
                    'w-4 h-4 rounded-full bg-gray-100 border border-gray-200 shrink-0 inline-flex items-center justify-center text-[10px] text-gray-600'
                },
                '图'
              ]
            : colorSpan

    // 音频/视频固定显示图标；其余类型优先显示缩略图
    const shouldUseMediaIcon = item?.type === 'audio' || item?.type === 'video'
    const mentionImageUrl = shouldUseMediaIcon
      ? ''
      : String(item?.image || item?.url || '').trim()
    const imgOrColor = mentionImageUrl
      ? [
          'img',
          {
            src: mentionImageUrl,
            class: 'w-4 h-4 rounded-full object-cover shrink-0'
          }
        ]
      : mediaIcon

    const suffix =
      item?.type === 'character'
        ? `-${item?.variantName || '基础形象'}`
        : item?.type === 'scene'
          ? '_0'
          : ''

    return [
      'span',
      mergeAttributes(
        {
          class:
            'inline-flex h-6 items-center gap-1.5 bg-white border border-gray-200 rounded-full px-1.5 mx-1.5 text-[11px] font-medium text-black cursor-pointer hover:border-gray-300 shadow-sm transition-colors align-middle select-none'
        },
        HTMLAttributes,
        { 'data-type': this.name }
      ),
      imgOrColor,
      [
        'span',
        { class: 'truncate max-w-[120px]' },
        `${node.attrs.label}${suffix}`
      ]
    ]
  }
})

interface Props {
  project: ProjectState
  projectLibrary?: SeriesProject | null
  clipId?: string
  initialContent?: string
  initialText?: string
  placeholder?: string
  autoFocusWhenEmpty?: boolean
  onSaveText?: (text: string) => void
  onSaveContent?: (payload: { text: string; html: string }) => void
  onSaveMultimodalPayload?: (payload: EditorMultimodalPayload) => void
  onRegenerateVideo?: (payload?: EditorMultimodalPayload) => void
  isGeneratingVideo?: boolean
}

const DEFAULT_SCRIPT = `<p></p>`

const ScriptEditorRich: React.FC<Props> = ({
  project,
  projectLibrary,
  clipId,
  initialContent,
  initialText,
  placeholder = '输入描述，@ 引用角色/道具/场景/媒体...',
  autoFocusWhenEmpty = false,
  onSaveText,
  onSaveContent,
  onSaveMultimodalPayload,
  onRegenerateVideo,
  isGeneratingVideo = false
}) => {
  const extractTextFromHtml = (html: string): string => {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
  }
  const isEffectivelyEmpty = (html: string, text: string): boolean => {
    if (text.trim().length > 0) return false
    if (html.includes('data-duration-tag')) return false
    if (html.includes('data-type="mention"')) return false
    return true
  }

  const toParagraphHtml = (text: string): string => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
    return `<p>${escaped}</p>`
  }

  const resolveInitialContent = useCallback((): string => {
    if (initialContent !== undefined) return initialContent
    if (initialText !== undefined) return toParagraphHtml(initialText)
    return DEFAULT_SCRIPT
  }, [initialContent, initialText])

  const activeClip = Array.isArray(project?.shots)
    ? project.shots.find((shot) => shot.id === clipId)
    : undefined
  const hasGeneratedVideo = Boolean(
    String(activeClip?.videoUrl || '').trim() ||
      String(activeClip?.interval?.videoUrl || '').trim()
  )

  const [savedContent, setSavedContent] = useState(resolveInitialContent)
  const [isEditing, setIsEditing] = useState(() => {
    const initial = resolveInitialContent()
    const initialTextValue = extractTextFromHtml(initial)
    return autoFocusWhenEmpty && isEffectivelyEmpty(initial, initialTextValue)
  })
  const [isEditorEmpty, setIsEditorEmpty] = useState(() => {
    const initial = resolveInitialContent()
    const initialTextValue = extractTextFromHtml(initial)
    return isEffectivelyEmpty(initial, initialTextValue)
  })

  const projectRef = useRef(project)
  const projectLibraryRef = useRef(projectLibrary || null)
  const mentionPickerRef = useRef<{
    popup?: Instance[]
    component?: ReactRenderer
    removeKeydown?: () => void
  } | null>(null)

  const destroyMentionPicker = () => {
    mentionPickerRef.current?.removeKeydown?.()
    mentionPickerRef.current?.popup?.[0]?.destroy()
    mentionPickerRef.current?.component?.destroy()
    mentionPickerRef.current = null
  }

  useEffect(() => {
    projectRef.current = project
  }, [project])
  useEffect(() => {
    projectLibraryRef.current = projectLibrary || null
  }, [projectLibrary])

  useEffect(() => {
    return () => {
      destroyMentionPicker()
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      DurationTag,
      CustomMention.configure({
        HTMLAttributes: {
          class: 'mention'
        },
        suggestion: {
          ...getSuggestion(
            () => projectRef.current,
            () => projectLibraryRef.current
          ),
          allowedPrefixes: null, // null allows any prefix in Tiptap
          allowSpaces: true,
          command: ({
            editor,
            range,
            props: mentionProps
          }: {
            editor: MentionCommandEditor
            range: unknown
            props?: MentionCommandPayload
          }) => {
            const selected = mentionProps?.itemData || mentionProps

            if (selected?.type === 'duration') {
              editor
                .chain()
                .focus()
                .insertContentAt(range, [
                  {
                    type: 'durationTag',
                    attrs: { value: extractDurationValue(selected) }
                  },
                  { type: 'text', text: ' ' }
                ])
                .run()
              return
            }

            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: 'mention',
                  attrs: {
                    id: mentionProps?.id,
                    label: mentionProps?.label,
                    itemData: mentionProps?.itemData || null
                  }
                },
                { type: 'text', text: ' ' }
              ])
              .run()
          }
        }
      })
    ],
    content: resolveInitialContent(),
    editable: isEditing,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[200px] outline-none'
      },
      handleClickOn: (view, _pos, node, nodePos, event, _direct) => {
        if (node.type.name === 'mention' && view.editable) {
          event.preventDefault()
          destroyMentionPicker()
          const scriptItems = buildMentionItems(projectRef.current, '')
          const libraryItems = buildProjectLibraryMentionItems(
            projectLibraryRef.current,
            ''
          )
          const target = event.target as HTMLElement | null
          const currentTarget =
            event.currentTarget instanceof Element ? event.currentTarget : null
          const getAnchorRect = () =>
            target?.getBoundingClientRect?.() ||
            currentTarget?.getBoundingClientRect?.()
          const component = new ReactRenderer(MentionList, {
            props: {
              items: scriptItems,
              libraryItems,
              allowDurationAction: false,
              onAddFromLibrary: () => {},
              command: (payload: MentionCommandPayload) => {
                const selected = payload?.itemData || payload
                const currentNode = view.state.doc.nodeAt(nodePos)
                if (!currentNode || currentNode.type.name !== 'mention') {
                  destroyMentionPicker()
                  return
                }

                const nextLabel =
                  selected?.name ||
                  payload?.label ||
                  payload?.id ||
                  currentNode.attrs.label ||
                  currentNode.attrs.id
                const nextId = selected?.id || payload?.id || nextLabel

                const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
                  ...currentNode.attrs,
                  id: nextId,
                  label: nextLabel,
                  itemData: selected
                })
                view.dispatch(tr)
                view.focus()
                destroyMentionPicker()
              }
            },
            editor
          })

          if (!getAnchorRect()) {
            component.destroy()
            return true
          }

          const popup = tippy('body', {
            getReferenceClientRect: getAnchorRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            hideOnClick: true,
            theme: 'mention-picker',
            arrow: false,
            maxWidth: 'none'
          })

          const onKeyDown = (keydownEvent: KeyboardEvent) => {
            if (keydownEvent.key === 'Escape') {
              keydownEvent.preventDefault()
              destroyMentionPicker()
              return
            }
            const handled = (component.ref as MentionListHandle | null)?.onKeyDown?.({
              event: keydownEvent
            })
            if (handled) {
              keydownEvent.preventDefault()
              keydownEvent.stopPropagation()
            }
          }
          document.addEventListener('keydown', onKeyDown, true)

          mentionPickerRef.current = {
            popup,
            component,
            removeKeydown: () =>
              document.removeEventListener('keydown', onKeyDown, true)
          }
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const text = currentEditor.getText().trim()
      const html = currentEditor.getHTML()
      setIsEditorEmpty(isEffectivelyEmpty(html, text))
    }
  })

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing)
    }
  }, [isEditing, editor])

  useEffect(() => {
    const nextContent = resolveInitialContent()
    const nextText = extractTextFromHtml(nextContent)
    const empty = isEffectivelyEmpty(nextContent, nextText)
    const shouldAutoFocus = autoFocusWhenEmpty && empty

    setSavedContent(nextContent)
    setIsEditorEmpty(empty)
    setIsEditing(shouldAutoFocus)
    if (!editor) return
    editor.commands.setContent(nextContent)
    if (shouldAutoFocus) {
      setTimeout(() => editor.commands.focus('end'), 0)
    }
  }, [clipId, editor, autoFocusWhenEmpty, resolveInitialContent])

  const buildEditorMultimodalPayload = (): (EditorMultimodalPayload & {
    html: string
    text: string
  }) | null => {
    if (!editor) return null
    const html = editor.getHTML()
    const text = editor.getText().trim()
    const json = editor.getJSON() as RichDocRoot
    const output = formatEditorConsoleOutput(project, json, text)
    const multimodalPayload = buildMultimodalPayload(output)

    console.group('[ScriptEditorRich] 保存输出')
    console.log(output.storyboardText)
    console.log('multimodal_payload:', multimodalPayload)
    console.log(
      'images:',
      output.resourceReferences.images.map((img) => ({
        id: img.id,
        name: img.name,
        url: img.url,
        assetId: img.assetId
      }))
    )
    console.log(
      'videos:',
      output.resourceReferences.videos.map((vid) => ({
        id: vid.id,
        name: vid.name,
        url: vid.url,
        assetId: vid.assetId
      }))
    )
    console.log(
      'audios:',
      output.resourceReferences.audios.map((aud) => ({
        id: aud.id,
        name: aud.name,
        url: aud.url,
        assetId: aud.assetId
      }))
    )
    console.groupEnd()

    return {
      html,
      text,
      storyboardText: output.storyboardText,
      multimodalPayload
    }
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-primary)] rounded-xl p-4 h-full min-h-0 flex flex-col shadow-sm transition-all duration-200">
      <style>{`
        .ProseMirror p {
          margin-bottom: 0.7em;
          line-height: 2;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-muted);
          pointer-events: none;
          height: 0;
        }
        .hide-number-spinners::-webkit-inner-spin-button,
        .hide-number-spinners::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-number-spinners {
          -moz-appearance: textfield;
        }
        .ProseMirror[contenteditable="false"] .duration-input {
          pointer-events: none;
        }
        .tippy-box[data-theme~="mention-picker"] {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
        }
        .tippy-box[data-theme~="mention-picker"] > .tippy-content {
          padding: 0 !important;
        }
        .tippy-box[data-theme~="mention-picker"] > .tippy-arrow {
          display: none !important;
        }
      `}</style>
      <div className="flex-1 min-h-0 relative flex flex-col cursor-text overflow-hidden">
        {isEditorEmpty ? (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true)
              setTimeout(() => editor?.commands.focus('end'), 0)
            }}
            className={`absolute left-0 top-0 z-10 text-[13px] leading-[2] text-[var(--text-muted)] ${
              isEditing ? 'pointer-events-none' : ''
            }`}
          >
            {placeholder}
          </button>
        ) : null}
        <EditorContent
          editor={editor}
          className="flex-1 min-h-0 w-full overflow-y-auto bg-transparent text-[13px] leading-relaxed text-[var(--text-primary)] pr-1"
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 pointer-events-auto shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                setIsEditing(false)
                editor?.commands.setContent(savedContent)
              }}
              className="px-6 py-2 rounded-full text-[13px] font-medium bg-white text-black border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
            >
              取消
            </button>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                setIsEditing(false)
                const nextPayload = buildEditorMultimodalPayload()
                if (!nextPayload) return
                setSavedContent(nextPayload.html)
                onSaveText?.(nextPayload.text)
                onSaveContent?.({ text: nextPayload.text, html: nextPayload.html })
                onSaveMultimodalPayload?.({
                  storyboardText: nextPayload.storyboardText,
                  multimodalPayload: nextPayload.multimodalPayload
                })
              }}
              className="px-6 py-2 rounded-full text-[13px] font-medium bg-black text-white hover:bg-gray-800 transition-colors shadow-sm"
            >
              保存
            </button>
          </>
        ) : (
          <>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                setIsEditing(true)
                setTimeout(() => editor?.commands.focus(), 0)
              }}
              className="px-6 py-2 rounded-full text-[13px] font-medium bg-white text-black border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5" />
              编辑脚本
            </button>
            {hasGeneratedVideo && (
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation()
                  const nextPayload = buildEditorMultimodalPayload()
                  if (!nextPayload) {
                    onRegenerateVideo?.()
                    return
                  }
                  onSaveMultimodalPayload?.({
                    storyboardText: nextPayload.storyboardText,
                    multimodalPayload: nextPayload.multimodalPayload
                  })
                  onRegenerateVideo?.({
                    storyboardText: nextPayload.storyboardText,
                    multimodalPayload: nextPayload.multimodalPayload
                  })
                }}
                disabled={isGeneratingVideo}
                className="px-6 py-2 rounded-full text-[13px] font-medium bg-black text-white hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
              >
                <Film className="w-3.5 h-3.5" />
                {isGeneratingVideo ? '生成中...' : '再次生成'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ScriptEditorRich
