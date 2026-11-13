import type { AnchorHTMLAttributes, MouseEvent } from 'react'

// 原版大量使用 <a href="javascript:void(0);">。React 19 会拦截 javascript: 地址，这里改用 href="#"：
// 保留 href 以获得 a[href] 的样式（颜色、手型光标），点击时阻止默认行为，避免 hash 路由被改动。
export function JsLink({ onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      href="#"
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        onClick?.(e)
      }}
    >
      {children}
    </a>
  )
}
