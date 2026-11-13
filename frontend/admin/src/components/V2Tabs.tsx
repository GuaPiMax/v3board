// 标签页（系统配置使用）：各预设都输出 antd 3（rc-tabs 9）的 DOM 与交互，样式见 styles/_antd3-tabs.scss（皮肤只换颜色、线宽）：
//   - 标签栏放不下时两侧显示 ‹ › 按钮，每次翻过一个标签栏的宽度；切换标签后把选中的标签滚动到可见
//   - ←→（↑↓）键在标签间循环切换；切换时内容区左右滑动，访问过的标签页保持渲染
// 不用 antd 6 的 Tabs：它的标签间距小一半，放不下时改为手指滑动 + 「…」菜单，内容区也不滑动，与原版不同
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TransitionEvent,
} from 'react'
import { useUi } from '@/stores/appearance'

export interface V2TabItem {
  key: string
  label: ReactNode
  children?: ReactNode
}

interface V2TabsProps {
  items: V2TabItem[]
  /** 受控：当前标签由父组件持有（配合 onChange）；不传时组件自己记住选中的标签 */
  activeKey?: string
  defaultActiveKey?: string
  size?: 'large'
  onChange?: (key: string) => void
}

export function V2Tabs({ items, activeKey: controlledKey, defaultActiveKey, size, onChange }: V2TabsProps) {
  const [innerKey, setInnerKey] = useState(() => controlledKey ?? defaultActiveKey ?? items[0]?.key ?? '')
  const activeKey = controlledKey ?? innerKey
  const [visited, setVisited] = useState(() => new Set([activeKey]))
  // 受控模式下父组件直接切换标签：把它记为访问过，切走后仍保持渲染（渲染期间按 props 调整 state 的写法）
  if (!visited.has(activeKey)) setVisited(new Set(visited).add(activeKey))
  const activeIndex = items.findIndex((item) => item.key === activeKey)

  const select = (key: string) => {
    if (key === activeKey) return
    // 受控时由父组件在 onChange 里切换，再由上面的渲染期同步记为访问过
    if (controlledKey === undefined) {
      setVisited((keys) => new Set(keys).add(key))
      setInnerKey(key)
    }
    onChange?.(key)
  }

  // 与 rc-tabs 9 一致：→ / ↓ 选下一个，← / ↑ 选上一个，首尾循环
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    select(items[(activeIndex + step + items.length) % items.length].key)
  }

  return (
    <div className={`ant-tabs ant-tabs-top${size === 'large' ? ' ant-tabs-large' : ''} ant-tabs-line`}>
      <TabBar items={items} activeKey={activeKey} large={size === 'large'} onTabClick={select} onKeyDown={onKeyDown} />
      <div
        className="ant-tabs-content ant-tabs-content-animated ant-tabs-top-content"
        style={{ marginLeft: `${-activeIndex * 100}%` }}
      >
        {items.map((item) => {
          const active = item.key === activeKey
          return (
            <div
              key={item.key}
              role="tabpanel"
              aria-hidden={active ? 'false' : 'true'}
              // 非活动标签页里的按钮 / 下拉 / 文本域不可聚焦、不可点击（React 19 支持布尔值）
              inert={!active}
              className={`ant-tabs-tabpane ant-tabs-tabpane-${active ? 'active' : 'inactive'}`}
            >
              {visited.has(item.key) && item.children}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface TabBarProps {
  items: V2TabItem[]
  activeKey: string
  large: boolean
  onTabClick: (key: string) => void
  onKeyDown: (e: KeyboardEvent) => void
}

const num = (style: CSSStyleDeclaration, property: string) => Number.parseFloat(style.getPropertyValue(property)) || 0

/** 标签在标签栏里的左侧位置（rc-tabs 9 的 getLeft：前面各标签的 offsetWidth 与左右外边距之和，再加自己的左外边距） */
function getLeft(tab: HTMLElement, nav: HTMLElement) {
  let total = num(getComputedStyle(nav), 'padding-left')
  for (const node of tab.parentElement?.children ?? []) {
    const style = getComputedStyle(node)
    if (node === tab) {
      total += num(style, 'margin-left')
      break
    }
    total += num(style, 'margin-left') + (node as HTMLElement).offsetWidth + num(style, 'margin-right')
    if (style.boxSizing === 'content-box') total += num(style, 'border-left-width') + num(style, 'border-right-width')
  }
  return total
}

// antd 3 的 ScrollableInkTabBar：标签栏根节点 + 可滚动的标签容器 + 墨条（逻辑与 rc-tabs 9 相同，直接操作 DOM 的部分也一致）
function TabBar({ items, activeKey, large, onTabClick, onKeyDown }: TabBarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navWrapRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const lastShown = useRef(false)
  const prevActiveKey = useRef<string | undefined>(undefined)
  const pendingScroll = useRef(false)
  const [arrows, setArrows] = useState({ next: false, prev: false })
  // 与 class 组件的 this.state 一样：取上一次渲染时的状态
  const arrowsRef = useRef(arrows)
  arrowsRef.current = arrows
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)

  const shown = (state = arrowsRef.current) => state.next || state.prev

  /** 平移标签容器（只能向左，最多到 0） */
  const setOffset = (target: number, checkNextPrev = true) => {
    const value = Math.min(0, target)
    if (offset.current === value) return
    offset.current = value
    if (navRef.current) navRef.current.style.transform = `translate3d(${value}px,0,0)`
    if (checkNextPrev) setNextPrev()
  }

  /** 按内容是否放得下决定两侧按钮；放得下时回到 0，右侧已到底时贴住右边 */
  const setNextPrev = () => {
    const tabs = tabsRef.current
    const container = containerRef.current
    const navWrap = navWrapRef.current
    if (!tabs || !container || !navWrap) return arrowsRef.current
    const navWidth = tabs.scrollWidth
    const containerWidth = container.offsetWidth + 1
    const minOffset = containerWidth - navWidth
    let current = offset.current
    let next: boolean
    if (minOffset >= 0) {
      next = false
      setOffset(0, false)
      current = 0
    } else if (minOffset < current) {
      next = true
    } else {
      next = false
      const realOffset = navWrap.offsetWidth - navWidth
      setOffset(realOffset, false)
      current = realOffset
    }
    const result = { next, prev: current < 0 }
    setArrows((state) => (state.next === result.next && state.prev === result.prev ? state : result))
    return result
  }

  /** 选中的标签不在可见范围内时滚动到可见（按钮刚出现时不滚动） */
  const scrollToActiveTab = (e?: { target: EventTarget; currentTarget: EventTarget }) => {
    const tab = activeTabRef.current
    const navWrap = navWrapRef.current
    if ((e && e.target !== e.currentTarget) || !tab || !navWrap) return
    const needToScroll = shown() && lastShown.current
    lastShown.current = shown()
    if (!needToScroll) return
    const tabWidth = tab.scrollWidth
    const wrapWidth = navWrap.offsetWidth
    const wrapLeft = navWrap.getBoundingClientRect().left
    const tabLeft = tab.getBoundingClientRect().left
    if (wrapLeft > tabLeft) setOffset(offset.current + (wrapLeft - tabLeft))
    else if (wrapLeft + wrapWidth < tabLeft + tabWidth) setOffset(offset.current - (tabLeft + tabWidth - (wrapLeft + wrapWidth)))
  }

  /** 墨条：位置、宽度与选中的标签相同（hide：先隐藏再显示，挂载时不播放从 0 开始的动画） */
  const updateInkBar = (hide = false) => {
    const ink = inkRef.current
    const tab = activeTabRef.current
    const nav = navRef.current ?? rootRef.current
    if (!ink || !nav) return
    const style = ink.style
    if (hide) style.display = 'none'
    if (tab) {
      style.transform = ''
      style.width = ''
      const left = getLeft(tab, nav)
      let width = tab.offsetWidth
      if (width === rootRef.current?.offsetWidth) width = 0
      style.transform = `translate3d(${left}px,0,0)`
      style.width = `${width}px`
    }
    style.display = items.some((item) => item.key === activeKey) ? 'block' : 'none'
  }

  // 每次渲染后（rc-tabs 9 的 componentDidMount / componentDidUpdate）：墨条先更新（子组件），再更新两侧按钮与滚动位置。
  // 按钮状态没变时 setArrows 返回原对象、不会重新渲染；forceUpdate 只在按钮出现 / 消失时发生一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const mounted = prevActiveKey.current !== undefined
    if (mounted) updateInkBar()
    const runPending = pendingScroll.current
    pendingScroll.current = false
    const result = setNextPrev()
    if (shown(arrowsRef.current) !== shown(result)) {
      // 按钮出现 / 消失：等重新渲染后再滚动（原版 setState({}, scrollToActiveTab)）
      pendingScroll.current = true
      forceUpdate()
    } else if (!mounted || prevActiveKey.current !== activeKey) {
      scrollToActiveTab()
    }
    prevActiveKey.current = activeKey
    if (runPending) scrollToActiveTab()
  })

  // 运行中切换界面预设（顶栏的主题按钮）：新的样式在 App 的 layout effect 里才生效，晚于上面按旧样式的计算，
  // 这里（渲染提交之后）按新样式重新计算墨条与两侧按钮。不主动滚动到选中的标签：点 › 翻过的位置保持不变，
  // 与直接用新样式打开、做同样的操作相同（两侧按钮出现 / 消失时仍按上面的逻辑滚动）。挂载时不需要
  const ui = useUi()
  const measuredUi = useRef(ui)
  useEffect(() => {
    if (measuredUi.current === ui) return
    measuredUi.current = ui
    updateInkBar()
    setNextPrev()
    // 只跟随预设（回调里读取的都是 ref）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui])

  // 挂载：墨条在下一个任务里定位；容器宽度变化时（200ms 防抖）重新计算。只看宽度：两侧按钮与滚动位置只和宽度有关，
  // 高度变化时不用跳回选中的标签（运行中切换界面预设时下边线的粗细不同，标签栏高度差 1px，点 › 翻过的位置应保持）
  useEffect(() => {
    const timer = setTimeout(() => updateInkBar(true), 0)
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    let width: number | undefined
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return
      width = entry.contentRect.width
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        setNextPrev()
        scrollToActiveTab()
      }, 200)
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => {
      clearTimeout(timer)
      clearTimeout(resizeTimer)
      observer.disconnect()
    }
    // 只在挂载时注册（回调里读取的都是 ref）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showArrows = arrows.prev || arrows.next
  const arrowClass = (name: 'prev' | 'next', enabled: boolean) =>
    [`ant-tabs-tab-${name}`, !enabled && 'ant-tabs-tab-btn-disabled', showArrows && 'ant-tabs-tab-arrow-show']
      .filter(Boolean)
      .join(' ')
  const onPrevTransitionEnd = (e: TransitionEvent) => {
    if (e.propertyName !== 'opacity' || !containerRef.current) return
    scrollToActiveTab({ target: containerRef.current, currentTarget: containerRef.current })
  }

  return (
    <div
      role="tablist"
      className={`ant-tabs-bar ant-tabs-top-bar${large ? ' ant-tabs-large-bar' : ''}`}
      tabIndex={0}
      ref={rootRef}
      onKeyDown={onKeyDown}
    >
      <div
        className={`ant-tabs-nav-container${showArrows ? ' ant-tabs-nav-container-scrolling' : ''}`}
        ref={containerRef}
      >
        <span
          className={arrowClass('prev', arrows.prev)}
          onClick={arrows.prev ? () => setOffset(offset.current + (navWrapRef.current?.offsetWidth ?? 0)) : undefined}
          onTransitionEnd={onPrevTransitionEnd}
        >
          <span className="ant-tabs-tab-prev-icon">
            <LeftOutlined className="ant-tabs-tab-prev-icon-target" />
          </span>
        </span>
        <span
          className={arrowClass('next', arrows.next)}
          onClick={arrows.next ? () => setOffset(offset.current - (navWrapRef.current?.offsetWidth ?? 0)) : undefined}
        >
          <span className="ant-tabs-tab-next-icon">
            <RightOutlined className="ant-tabs-tab-next-icon-target" />
          </span>
        </span>
        <div className="ant-tabs-nav-wrap" ref={navWrapRef}>
          <div className="ant-tabs-nav-scroll">
            <div className="ant-tabs-nav ant-tabs-nav-animated" ref={navRef}>
              <div ref={tabsRef}>
                {items.map((item) => {
                  const active = item.key === activeKey
                  return (
                    <div
                      key={item.key}
                      role="tab"
                      aria-disabled="false"
                      aria-selected={active ? 'true' : 'false'}
                      className={`${active ? 'ant-tabs-tab-active' : ''} ant-tabs-tab`}
                      onClick={() => onTabClick(item.key)}
                      ref={active ? activeTabRef : undefined}
                    >
                      {item.label}
                    </div>
                  )
                })}
              </div>
              <div className="ant-tabs-ink-bar ant-tabs-ink-bar-animated" ref={inkRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
