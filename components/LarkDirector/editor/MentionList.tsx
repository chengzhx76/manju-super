import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState
} from 'react'
import { ChevronRight, Clock3 } from 'lucide-react'

export default forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [variationParent, setVariationParent] = useState<any | null>(null)
  const [variationParentIndex, setVariationParentIndex] = useState(0)
  const defaultItems = props.items || []
  const variationItems =
    variationParent?.type === 'character' && Array.isArray(variationParent?.variants)
      ? variationParent.variants.map((variant: any, index: number) => ({
          ...variationParent,
          id: `${variationParent.id}::${variant.id || index}`,
          variantName: variant.name,
          desc: variant.desc,
          image: variant.image || variationParent.image
        }))
      : []
  const isVariationMode = variationItems.length > 0
  const visibleItems = isVariationMode ? variationItems : defaultItems
  const quickActions =
    props.allowDurationAction && !isVariationMode
      ? [
          {
            key: 'duration',
            title: '添加时间',
            subtitle: '时间',
            Icon: Clock3
          }
        ]
      : []
  const bottomActions = [...quickActions]
  const actionStartIndex = visibleItems.length
  const itemCount = visibleItems.length + bottomActions.length
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)

  const selectItem = (index: number) => {
    if (index >= actionStartIndex) {
      const action = bottomActions[index - actionStartIndex]
      if (action) {
        props.command({
          id: 'duration-tag',
          label: '添加时间',
          itemData: {
            type: 'duration',
            name: '添加时间',
            value: 5.0
          }
        })
      }
      return
    }

    const item = visibleItems[index]

    if (item) {
      if (
        !isVariationMode &&
        item.type === 'character' &&
        Array.isArray(item.variants) &&
        item.variants.length > 1
      ) {
        setVariationParent(item)
        setVariationParentIndex(index)
        setSelectedIndex(0)
        return
      }
      props.command({ id: item.name, label: item.name, itemData: item })
    }
  }

  const openVariationPanel = (index: number): boolean => {
    if (isVariationMode) return false
    const item = visibleItems[index]
    if (
      item?.type !== 'character' ||
      !Array.isArray(item?.variants) ||
      item.variants.length <= 1
    ) {
      return false
    }
    setVariationParent(item)
    setVariationParentIndex(index)
    setSelectedIndex(0)
    return true
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
    setVariationParent(null)
    setVariationParentIndex(0)
  }, [props.items])

  useEffect(() => {
    const selectedEl = itemRefs.current[selectedIndex]
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    } else if (scrollContainerRef.current && selectedIndex === 0) {
      scrollContainerRef.current.scrollTo({ top: 0 })
    }
  }, [selectedIndex, visibleItems.length, isVariationMode])

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

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      if (event.key === 'ArrowRight') {
        return openVariationPanel(selectedIndex)
      }

      if (event.key === 'ArrowLeft') {
        if (isVariationMode) {
          setVariationParent(null)
          setSelectedIndex(variationParentIndex)
          return true
        }
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
              <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                <span className="text-[14px] leading-5 font-medium text-gray-900 truncate">
                  {isVariationMode ? item.variantName || '基础形象' : item.name}
                </span>
                <span className="text-[11px] leading-4 text-gray-400 truncate">
                  {item.desc}
                </span>
              </div>
              {!isVariationMode &&
              item.type === 'character' &&
              Array.isArray(item.variants) &&
              item.variants.length > 1 ? (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              ) : null}
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
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
