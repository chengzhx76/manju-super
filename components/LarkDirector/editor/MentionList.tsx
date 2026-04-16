import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState
} from 'react'
import { ChevronRight, User, MapPin, Package } from 'lucide-react'

export default forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [libraryExpanded, setLibraryExpanded] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState<
    'all' | 'character' | 'scene' | 'prop'
  >('all')
  const canAddFromLibrary = !!props.onAddFromLibrary
  const defaultItems = props.items || []
  const libraryItems = props.libraryItems || []
  const filteredLibraryItems = libraryItems.filter((item: any) => {
    if (libraryFilter === 'all') return true
    return item?.type === libraryFilter
  })
  const visibleItems = libraryExpanded ? filteredLibraryItems : defaultItems
  const bottomActions =
    canAddFromLibrary && !libraryExpanded
      ? [
          {
            key: 'character',
            title: '角色库',
            subtitle: '从项目角色库添加',
            filter: 'character' as const,
            Icon: User
          },
          {
            key: 'scene',
            title: '场景库',
            subtitle: '从项目场景库添加',
            filter: 'scene' as const,
            Icon: MapPin
          },
          {
            key: 'prop',
            title: '道具库',
            subtitle: '从项目道具库添加',
            filter: 'prop' as const,
            Icon: Package
          }
        ]
      : []
  const actionStartIndex = visibleItems.length
  const itemCount = visibleItems.length + bottomActions.length
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)

  const openLibraryByFilter = (filter: 'character' | 'scene' | 'prop') => {
    setLibraryExpanded(true)
    setLibraryFilter(filter)
    setSelectedIndex(0)
    props.onAddFromLibrary?.(filter)
  }

  const selectItem = (index: number) => {
    if (!libraryExpanded && index >= actionStartIndex) {
      const action = bottomActions[index - actionStartIndex]
      if (action) {
        openLibraryByFilter(action.filter)
      }
      return
    }

    const item = visibleItems[index]

    if (item) {
      props.command({ id: item.name, label: item.name, itemData: item })
    }
  }

  const upHandler = () => {
    if (itemCount === 0) return
    setSelectedIndex((selectedIndex + itemCount - 1) % itemCount)
  }

  const downHandler = () => {
    if (itemCount === 0) return
    setSelectedIndex((selectedIndex + 1) % itemCount)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    setSelectedIndex(0)
    setLibraryExpanded(false)
    setLibraryFilter('all')
  }, [props.items])

  useEffect(() => {
    const selectedEl = itemRefs.current[selectedIndex]
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    } else if (scrollContainerRef.current && selectedIndex === 0) {
      scrollContainerRef.current.scrollTo({ top: 0 })
    }
  }, [selectedIndex, libraryExpanded, visibleItems.length])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'ArrowRight') {
        if (!libraryExpanded && selectedIndex >= actionStartIndex) {
          const action = bottomActions[selectedIndex - actionStartIndex]
          if (action) {
            openLibraryByFilter(action.filter)
          }
          return true
        }
      }

      if (event.key === 'ArrowLeft') {
        if (libraryExpanded) {
          setLibraryExpanded(false)
          const fallbackIdx = bottomActions.findIndex(
            (action) => action.filter === libraryFilter
          )
          const actionIdx = fallbackIdx >= 0 ? fallbackIdx : 0
          setSelectedIndex(defaultItems.length + actionIdx)
          return true
        }
      }

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      return false
    }
  }))

  return (
    <div className="w-[260px] rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden z-[9999]">
      <style>{`
        .mention-list-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        ref={scrollContainerRef}
        className="mention-list-scroll max-h-[300px] overflow-y-auto p-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleItems.length ? (
          visibleItems.map((item: any, index: number) => (
            <button
              type="button"
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                index === selectedIndex ? 'bg-[#edf5ff]' : 'hover:bg-gray-50'
              }`}
              key={index}
              onClick={() => selectItem(index)}
            >
              <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center border border-gray-200">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name || ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-gray-500">
                    {(item.name || '?').slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[14px] leading-5 font-medium text-gray-900 truncate">
                  {item.name}
                </span>
                <span className="text-[11px] leading-4 text-gray-400 truncate">
                  {item.desc}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
            未找到结果
          </div>
        )}
      </div>

      {bottomActions.length > 0 ? (
        <div className="border-t border-gray-100 px-2 py-1.5">
          {bottomActions.map((action, idx) => {
            const actionIndex = actionStartIndex + idx
            const ActionIcon = action.Icon
            return (
              <button
                key={action.key}
                type="button"
                ref={(el) => {
                  itemRefs.current[actionIndex] = el
                }}
                className={`w-full text-left flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${
                  selectedIndex === actionIndex
                    ? 'bg-[#edf5ff]'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => selectItem(actionIndex)}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-gray-100 inline-flex items-center justify-center text-gray-500">
                    <ActionIcon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[14px] leading-5 font-medium text-gray-900 truncate">
                      {action.title}
                    </span>
                    <span className="text-[11px] leading-4 text-gray-400 truncate">
                      {action.subtitle}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
