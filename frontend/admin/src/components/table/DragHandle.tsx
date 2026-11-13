// 拖动排序的把手：原版在「排序」列放一个 menu 图标（cursor: move），拖动它移动整行
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { MenuOutlined } from '@ant-design/icons'
import { createContext, useContext } from 'react'

export interface DragRowContextValue {
  setActivatorNodeRef?: (element: HTMLElement | null) => void
  listeners?: DraggableSyntheticListeners
  attributes?: DraggableAttributes
}

export const DragRowContext = createContext<DragRowContextValue>({})

/** title：鼠标悬停提示（原版节点排序为「拖动排序」） */
export function DragHandle({ title }: { title?: string }) {
  const { setActivatorNodeRef, listeners, attributes } = useContext(DragRowContext)
  return <MenuOutlined ref={setActivatorNodeRef} style={{ cursor: 'move' }} title={title} {...attributes} {...listeners} />
}
