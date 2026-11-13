// 通用表格：antd 6 Table + 原版管理端的几个表格行为
//   1. 固定列（fixed: 'right'）在需要横向滚动时，按 antd 3 的方式显示成右侧的覆盖层：
//      antd 3 的固定列是单独一张按内容宽度排版（不换行）的表格，主表格里还有一份被遮住的同样内容（参与列宽与行高的计算）。
//      legacy 预设下这里同样把固定列的内容渲染两份：一份留在原位参与排版（不可见），一份按内容宽度浮在右侧显示
//   2. contextMenu：右键行时在鼠标位置弹出菜单（原版模块 Oa6W，容器 id 为 v2board-table-dropdown）
//   3. onDragSort：拖动 <DragHandle /> 排序（原版 react-drag-listview，回调原索引与目标索引）。
//      原版用浏览器原生拖放（半透明的行影像 + 虚线插入位置）；新版拖动的行跟随鼠标上下移动，其他行滑动让位
//   4. legacy：带 filters 的列使用 antd 3 样式的筛选下拉；排序列不显示 antd 4+ 才有的「点击升序」提示
//   5. legacy：行悬停与 antd 3 一样，CSS :hover 始终生效；有固定列的表格另外按 React 组件树维护悬停行
//      （antd 6 的悬停事件，语义与 antd 3 相同），没有固定列的表格不绑定悬停事件（见 LegacyCell）
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Table, type TableColumnsType, type TableProps } from 'antd'
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
} from 'react'
import type { UiPreset } from '@/app/uiPreset'
import { useUi } from '@/stores/appearance'
import { DragRowContext } from './DragHandle'
import { withLegacyFilter } from './LegacyFilterDropdown'

export interface V2TableProps<T> extends TableProps<T> {
  /** 右键菜单内容（原版为 ul.ant-dropdown-menu 结构） */
  contextMenu?: ReactNode
  /** 右键行时传入该行，左键点击行时传入 undefined（与原版一致） */
  onRowContextMenu?: (record: T | undefined) => void
  /** 暂时关闭右键菜单（原版节点排序模式）：行上不绑定点击 / 右键事件 */
  disableRightClick?: boolean
  /** 拖动排序结束 */
  onDragSort?: (fromIndex: number, toIndex: number) => void
}

type AnyRecord = object

function getKey<T extends AnyRecord>(record: T, index: number, rowKey: TableProps<T>['rowKey']): string {
  if (typeof rowKey === 'function') return String(rowKey(record, index))
  const key = (record as Record<string, unknown>)[(rowKey as string | undefined) ?? 'id']
  return String(key ?? index)
}

/** 固定列单元格的内容宽度（不含撑满的块级容器），加上左右内边距与边框 */
function naturalWidth(cell: HTMLElement): number {
  const float = cell.querySelector<HTMLElement>(':scope > .v2b-fix-end-float')
  let content: number
  if (float) {
    content = float.getBoundingClientRect().width
  } else {
    const first = cell.firstElementChild as HTMLElement | null
    const target = first && getComputedStyle(first).display === 'block' ? first : cell
    const range = document.createRange()
    range.selectNodeContents(target)
    content = range.getBoundingClientRect().width
  }
  const cs = getComputedStyle(cell)
  return (
    content +
    Number.parseFloat(cs.paddingLeft) +
    Number.parseFloat(cs.paddingRight) +
    Number.parseFloat(cs.borderLeftWidth) +
    Number.parseFloat(cs.borderRightWidth)
  )
}

const hasFilters = (column: object) => 'filters' in column && Boolean((column as { filters?: unknown[] }).filters?.length)

/** 筛选下拉挂在表格节点里（见 V2Table 里 initialFilterKeys 的说明） */
const inTable = (trigger: HTMLElement) => trigger.closest<HTMLElement>('.ant-table') ?? document.body

/**
 * legacy：固定在右侧的列把内容渲染两份（见文件头说明）；带 filters 的列换成 antd 3 样式的筛选下拉，
 * 首次渲染后才出现筛选项的列，下拉挂在表格节点里
 */
function withLegacyColumns<T>(
  columns: TableColumnsType<T> | undefined,
  initialFilterKeys: Set<string>,
  ui: UiPreset,
): TableColumnsType<T> | undefined {
  if (ui !== 'legacy' || !columns) return columns
  return columns.map((original) => {
    let column = withLegacyFilter(original)
    if (hasFilters(column) && !initialFilterKeys.has(String(column.key))) {
      column = { ...column, filterDropdownProps: { getPopupContainer: inTable, ...column.filterDropdownProps } }
    }
    if (column.fixed !== 'right' && column.fixed !== 'end') return column
    const render = column.render
    return {
      ...column,
      render: (value: unknown, record: T, index: number) => {
        const content = render ? render(value, record, index) : (value as ReactNode)
        return (
          <>
            <div className="v2b-fix-end-flow">{content as ReactNode}</div>
            <div className="v2b-fix-end-float">
              <div>{content as ReactNode}</div>
            </div>
          </>
        )
      },
    }
  })
}

/**
 * 固定列覆盖层：表格需要横向滚动时，给容器加 v2b-fix-end-overlay，并写入内容宽度与剩余可滚动距离
 * （样式在 antd3-compat.scss，只在 legacy 预设下生效）
 */
function useFixEndOverlay(wrapperRef: React.RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const wrap = wrapperRef.current
    if (!wrap) return
    const scroller = () => wrap.querySelector<HTMLElement>('.ant-table-content, .ant-table-body')
    const updateRest = () => {
      const el = scroller()
      if (!el) return
      const rest = Math.max(0, el.scrollWidth - el.clientWidth - el.scrollLeft)
      wrap.style.setProperty('--v2b-fix-end-rest', `${rest}px`)
    }
    const update = () => {
      const content = scroller()
      const cells = [...wrap.querySelectorAll<HTMLElement>('.ant-table-cell-fix-end:last-child')]
      const overflow = Boolean(content && cells.length && content.scrollWidth > content.clientWidth + 1)
      wrap.classList.toggle('v2b-fix-end-overlay', overflow)
      if (overflow) {
        // antd 3 的固定列表格也有 colgroup，列设置的 width 是最小宽度（例如节点管理的「操作」列 100px）
        const col = content?.querySelector<HTMLTableColElement>(':scope > table > colgroup > col:last-child')
        const colWidth = col ? Number.parseFloat(col.style.width) || 0 : 0
        // 与 antd 3 一样使用精确（可能带小数）的宽度
        const width = Math.max(colWidth, ...cells.map(naturalWidth))
        wrap.style.setProperty('--v2b-fix-end-width', `${width}px`)
        updateRest()
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(wrap)
    // scroll 不冒泡，在捕获阶段监听表格内部的横向滚动
    wrap.addEventListener('scroll', updateRest, { capture: true, passive: true })
    void document.fonts?.ready.then(update)
    return () => {
      observer.disconnect()
      wrap.removeEventListener('scroll', updateRest, { capture: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/**
 * legacy 下没有固定列的表格的表体单元格：不绑定 antd 6 的悬停事件。antd 3（rc-table 6）只在有固定列时
 * （isAnyColumnsFixed，用来同步固定列与主表格）按 React 组件树维护悬停行，其余表格只有 CSS :hover。
 * 按组件树判断时，行里渲染的弹窗打开后鼠标在弹窗上也算在这一行里，行一直高亮（原版订单详情没有这个效果）。
 * 悬停背景由 antd3-compat.scss 的 :hover 规则显示
 */
function LegacyCell({ onMouseEnter: _enter, onMouseLeave: _leave, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />
}

/**
 * 拖动的行只上下移动，并且不超出表体：拖过第一行 / 最后一行后停在两端（与原版一样，插入位置停在两端），
 * 也不会把表格的滚动区域撑大。表体从按下的把手往上找，按它当前的位置计算，拖动时页面滚动也成立
 * （行的位置在开始拖动时测量，拖动库渲染时按「测量时的位置 + transform」显示）
 */
const restrictToBody: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
  const handle = activatorEvent?.target
  const body = handle instanceof Element ? handle.closest('.ant-table-tbody')?.getBoundingClientRect() : undefined
  if (!body || !activeNodeRect) return transform
  return {
    ...transform,
    x: body.left - activeNodeRect.left,
    y: Math.min(Math.max(transform.y, body.top - activeNodeRect.top), body.bottom - activeNodeRect.bottom),
  }
}
const DRAG_MODIFIERS = [restrictToBody]

function SortableRow(props: HTMLAttributes<HTMLTableRowElement> & { 'data-row-key'?: string | number }) {
  // antd 传入的 data-row-key 是 rowKey 的原值（数字 id 时是数字），要和 SortableContext 的 items 一样用字符串，
  // 否则拖动库找不到这一行，拖动时行不跟随鼠标、其他行也不让位
  const id = String(props['data-row-key'] ?? '')
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 999 } : {}),
  }
  return (
    <DragRowContext.Provider value={{ setActivatorNodeRef, listeners, attributes }}>
      <tr {...props} ref={setNodeRef} style={style} />
    </DragRowContext.Provider>
  )
}

export function V2Table<T extends AnyRecord>({
  contextMenu,
  onRowContextMenu,
  disableRightClick = false,
  onDragSort,
  onRow,
  rowKey = 'id',
  tableLayout = 'auto',
  components,
  dataSource,
  ...rest
}: V2TableProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  // antd 3 的表格只有在内部表格实例创建后，才把筛选下拉的弹出层放进表格节点（继承表格的 menlo 字体），
  // 首次渲染时就有筛选项的列（例如节点管理的「节点ID」）下拉挂在 body 上；之后才出现筛选项的列
  // （例如「权限组」，选项来自接口）挂在表格里
  const [initialFilterKeys] = useState(
    () => new Set((rest.columns ?? []).filter(hasFilters).map((column) => String(column.key))),
  )
  // 界面预设可以在运行中切换（顶栏的主题按钮），切换后按新的预设重新生成列
  const ui = useUi()
  const columns = useMemo(
    () => withLegacyColumns(rest.columns, initialFilterKeys, ui),
    [rest.columns, initialFilterKeys, ui],
  )
  const scriptHover = ui !== 'legacy' || (rest.columns ?? []).some((column) => column.fixed)
  useFixEndOverlay(wrapperRef, [dataSource, columns])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }))
  // 松手后立即按新顺序显示，与拖动结束在同一次渲染里：页面的数据晚一步更新时（例如节点排序改的是查询缓存，
  // 页面等缓存通知后才重新渲染），中间会有一帧按原来的顺序显示，各行先跳回原位再滑到新位置。页面的数据更新后以页面为准
  const [dropped, setDropped] = useState<{ source: V2TableProps<T>['dataSource']; rows: readonly T[] }>()
  const rows = dropped && dropped.source === dataSource ? dropped.rows : dataSource

  const rowHandlers = useCallback<NonNullable<TableProps<T>['onRow']>>(
    (record, index) => {
      const own = onRow?.(record, index) ?? {}
      if (!contextMenu || disableRightClick) return own
      // 行内的下拉菜单、抽屉等是 portal，事件会沿 React 树冒泡到行上；只处理真正发生在这一行里的事件
      // （原版在订阅「编辑」菜单项上 stopPropagation，这里统一处理）
      const inRow = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.contains(e.target as Node)
      return {
        ...own,
        onClick: (e) => {
          own.onClick?.(e)
          if (!inRow(e)) return
          onRowContextMenu?.(undefined)
          setMenuPosition(null)
        },
        onContextMenu: (e) => {
          own.onContextMenu?.(e)
          if (!inRow(e)) return
          e.preventDefault()
          onRowContextMenu?.(record)
          setMenuPosition({ x: e.clientX, y: e.clientY })
        },
      }
    },
    [contextMenu, disableRightClick, onRow, onRowContextMenu],
  )

  const table = (
    <Table<T>
      // 原版的排序列没有「点击升序」之类的提示（表头里有自己的问号提示，例如节点管理的「人数」）
      showSorterTooltip={false}
      {...rest}
      columns={columns}
      rowKey={rowKey}
      tableLayout={tableLayout}
      dataSource={rows}
      onRow={rowHandlers}
      components={{
        ...components,
        body: {
          ...components?.body,
          ...(!scriptHover && { cell: LegacyCell }),
          ...(onDragSort && { row: SortableRow }),
        },
      }}
    />
  )

  const keys = (rows ?? []).map((record, index) => getKey(record, index, rowKey))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = keys.indexOf(String(active.id))
    const to = keys.indexOf(String(over.id))
    setDropped({ source: dataSource, rows: arrayMove([...(rows ?? [])], from, to) })
    onDragSort?.(from, to)
  }

  return (
    <div ref={wrapperRef} className="v2b-table">
      {onDragSort ? (
        // 插入位置取离拖动的行最近的一行（默认按重叠面积判断：拖出最后一行后没有目标，所有行跳回原位，松手也不排序）
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={DRAG_MODIFIERS}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={keys} strategy={verticalListSortingStrategy}>
            {table}
          </SortableContext>
        </DndContext>
      ) : (
        table
      )}
      {contextMenu && (
        <div
          id="v2board-table-dropdown"
          className="ant-dropdown ant-dropdown-placement-bottomLeft v2b ant-dropdown-css-var"
          style={
            menuPosition
              ? { top: menuPosition.y, left: menuPosition.x, display: 'unset' }
              : { display: 'none', position: 'fixed', top: 0, left: 0 }
          }
          onClick={() => setMenuPosition(null)}
        >
          {contextMenu}
        </div>
      )}
    </div>
  )
}
