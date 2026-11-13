// 悬停触发的下拉菜单（原版节点管理的「+」新建菜单）：
// antd 6 在鼠标进入弹出层时会按 mouseEnterDelay（0.15s）再安排一次「打开」，进入后立刻点击菜单项的话，
// 菜单关闭后又会被重新打开；antd 3 进入弹出层时只取消关闭计时。这里用受控的 open 忽略点击菜单项后 0.3s 内的重新打开
import { useRef, useState } from 'react'

export function useHoverMenuClose() {
  const [open, setOpen] = useState(false)
  const closedAt = useRef(0)
  const onOpenChange = (next: boolean, info?: { source: 'trigger' | 'menu' }) => {
    if (info?.source === 'menu') closedAt.current = Date.now()
    else if (next && Date.now() - closedAt.current < 300) return
    setOpen(next)
  }
  return { open, onOpenChange }
}
