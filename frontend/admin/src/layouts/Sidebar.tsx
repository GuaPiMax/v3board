import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { JsLink } from '@/components/JsLink'
import { useSiteTitle } from '@/stores/branding'
import { useLayoutStore } from '@/stores/layout'
import { MENU } from './menu'

// 菜单的滚动位置：每个页面各自包一层布局，切换页面时侧边栏重新挂载，原版的菜单会回到顶部（窗口矮时点下面的
// 「队列监控」等，菜单跳回开头）。这里记住滚动位置、挂载时恢复，有意修正
let menuScrollTop = 0

export function Sidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const toggleNav = useLayoutStore((s) => s.toggleNav)
  const title = useSiteTitle()
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    menu.scrollTop = menuScrollTop
    const onScroll = () => {
      menuScrollTop = menu.scrollTop
    }
    menu.addEventListener('scroll', onScroll, { passive: true })
    return () => menu.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav id="sidebar">
      <div className="smini-hidden bg-header-dark">
        <div className="content-header justify-content-lg-center bg-black-10">
          <a className="link-fx font-size-lg text-white" href="./">
            <span className="text-white-75">{title}</span>
          </a>
          <div className="d-lg-none">
            <JsLink className="text-white ml-2" data-toggle="layout" data-action="sidebar_close" onClick={() => toggleNav()}>
              <i className="fa fa-times-circle" />
            </JsLink>
          </div>
        </div>
      </div>
      <div ref={menuRef} className="content-side content-side-full">
        <ul className="nav-main">
          {MENU.map((entry) =>
            entry.type === 'heading' ? (
              <li key={entry.title} className="nav-main-heading">
                {entry.title}
              </li>
            ) : (
              <li key={entry.href} className="nav-main-item">
                <a
                  className={`nav-main-link${pathname === entry.href ? ' active' : ''}`}
                  onClick={() => {
                    navigate(entry.href)
                    toggleNav(false)
                  }}
                >
                  <i className={`nav-main-link-icon si ${entry.icon}`} />
                  <span className="nav-main-link-name">{entry.title}</span>
                </a>
              </li>
            ),
          )}
        </ul>
      </div>
      <div className="v2board-copyright">{title} v1.7.5</div>
    </nav>
  )
}
