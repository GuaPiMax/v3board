import { useEffect, type ReactNode } from 'react'
import { useBackendFrontendSettings } from '@/hooks/useBackendFrontendSettings'
import { useLayoutStore } from '@/stores/layout'
import { useThemeStore } from '@/stores/theme'
import { Header, type HeaderSearch } from './Header'
import { Sidebar } from './Sidebar'

interface AdminLayoutProps {
  title?: ReactNode
  search?: HeaderSearch
  /** 整页加载中：主区域只显示加载动画 */
  loading?: boolean
  children?: ReactNode
}

// 与原版一致：每个页面各自包一层布局（模块 Bl7J）
export function AdminLayout({ title, search, loading, children }: AdminLayoutProps) {
  const theme = useThemeStore((s) => s.theme)
  const { showNav, toggleNav } = useLayoutStore()
  useBackendFrontendSettings()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const className = [
    'sidebar-o',
    theme.sidebar === 'dark' && 'sidebar-dark',
    theme.header === 'dark' && 'page-header-dark',
    'side-scroll page-header-fixed main-content-boxed side-trans-enabled',
    showNav && 'sidebar-o-xs',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div id="page-container" className={className}>
      <div onClick={() => toggleNav()} className="v2board-nav-mask" style={{ display: showNav ? 'block' : 'none' }} />
      <Sidebar />
      <Header search={search} title={title} />
      {loading ? (
        <main id="main-container">
          <div className="content content-full text-center pt-5">
            <div className="spinner-grow text-primary" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        </main>
      ) : (
        <main id="main-container">
          <div className="p-0 p-lg-4">{children}</div>
        </main>
      )}
    </div>
  )
}
