// 悬停提示的 antd 3 行为：只按鼠标是否在触发元素的 React 子树里（包括从里面打开的抽屉、弹窗等 portal）显示 / 隐藏，
// 延迟与 antd 一样是 0.1s。用法：<Tooltip open={hover.open}><Button.Group {...hover.handlers}>…
// antd 6 的悬停提示还会在触发元素 DOM 之外按下鼠标时关闭，例如用户管理的 Tips 提示：打开过滤器抽屉后在抽屉里点一下，
// antd 3 的提示仍然显示，antd 6 会关闭
import { useEffect, useRef, useState } from 'react'

const DELAY = 100

export function useLegacyHover() {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    const pending = timer
    return () => clearTimeout(pending.current)
  }, [])
  const schedule = (next: boolean) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(next), DELAY)
  }
  return {
    open,
    handlers: { onMouseEnter: () => schedule(true), onMouseLeave: () => schedule(false) },
  }
}
