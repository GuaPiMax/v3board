import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { settings } from '@/app/settings'
import { JsLink } from '@/components/JsLink'
import { useLayoutStore } from '@/stores/layout'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'
import { toggleDarkMode, useDarkMode, useDarkModeFixed } from '@/utils/darkMode'
import { removeToken } from '@/utils/storage'
import { UiSwitch } from './UiSwitch'

export interface HeaderSearch {
  placeholder?: string
  defaultValue?: string
  onChange: (value: string) => void
}

interface HeaderProps {
  title?: ReactNode
  search?: HeaderSearch
}

export function Header({ title, search }: HeaderProps) {
  const navigate = useNavigate()
  const darkHeader = useThemeStore((s) => s.theme.header) === 'dark'
  const toggleNav = useLayoutStore((s) => s.toggleNav)
  const { userInfo, loadUserInfo } = useUserStore()
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showSearchBar, setShowSearchBar] = useState(false)
  const darkModeFixed = useDarkModeFixed()
  const dark = useDarkMode()

  useEffect(() => {
    if (!userInfo?.email) void loadUserInfo()
    // 只在挂载时检查（与原版 componentDidMount 一致）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 与原版一致：展开后点击页面任意处收起
  useEffect(() => {
    if (!showAvatarMenu) return
    const close = () => setShowAvatarMenu(false)
    const timer = window.setTimeout(() => document.addEventListener('click', close, { once: true }))
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [showAvatarMenu])

  const btn = (extra = '') => `${darkHeader ? 'btn btn-primary' : 'btn'}${extra}`

  const logout = () => {
    removeToken()
    useUserStore.getState().clear()
    navigate('/login')
  }

  return (
    <header id="page-header">
      <div className="content-header" style={{ maxWidth: 'unset' }}>
        <div className="sidebar-toggle" style={{ display: search ? 'block' : 'none' }}>
          <button type="button" className={btn(' mr-1 d-lg-none')} onClick={() => toggleNav()}>
            <i className="fa fa-fw fa-bars" />
          </button>
          {search && (
            <button type="button" className={btn()} onClick={() => setShowSearchBar(true)}>
              <i className="fa fa-fw fa-search" /> <span className="ml-1 d-none d-sm-inline-block">搜索</span>
            </button>
          )}
        </div>
        <div className={darkHeader ? 'v2board-container-title text-white' : 'v2board-container-title text-black'}>
          {title}
          {/* 公开演示站的提示（原版没有，config.js 配置了 demo 时显示）：手机上只显示「演示」 */}
          {settings.demo?.notice && (
            <span className="v2board-demo-tag">
              <span className="d-none d-lg-inline">{settings.demo.notice}</span>
              <span className="d-lg-none">演示</span>
            </span>
          )}
        </div>
        <div>
          {/* 界面风格（原版没有）：放在暗黑模式切换的左边，右侧原有的两个按钮位置不变 */}
          <UiSwitch buttonClassName={btn(' mr-1')} />
          {/* 固定暗色的皮肤不显示暗黑模式切换 */}
          {!darkModeFixed && (
            <div className="dropdown d-inline-block">
              <button type="button" className={btn(' mr-1')} onClick={() => void toggleDarkMode()}>
                {dark ? <i className="far fa fa-moon" /> : <i className="far fa fa-sun" />}
              </button>
            </div>
          )}
          <div className="dropdown d-inline-block">
            <button
              type="button"
              className={btn()}
              id="page-header-user-dropdown"
              data-toggle="dropdown"
              aria-haspopup="true"
              aria-expanded="false"
              onClick={() => setShowAvatarMenu((v) => !v)}
            >
              <i className="far fa fa-user-circle" />
              <span className="d-none d-lg-inline ml-1">{userInfo?.email}</span>
              <i className="fa fa-fw fa-angle-down ml-1" />
            </button>
            <div
              className={`dropdown-menu dropdown-menu-right dropdown-menu-lg p-0${showAvatarMenu ? ' show' : ''}`}
              aria-labelledby="page-header-user-dropdown"
            >
              <div className="p-2">
                <JsLink className="dropdown-item d-flex justify-content-between align-items-center" onClick={logout}>
                  登出
                  <i className="fa fa-fw fa-sign-out-alt text-danger ml-1" />
                </JsLink>
              </div>
            </div>
          </div>
        </div>
      </div>
      {search && (
        <div className={`overlay-header bg-dark ${showSearchBar ? 'show' : ''}`}>
          <div className="content-header bg-dark">
            <div className="w-100">
              <div className="input-group">
                <div className="input-group-prepend">
                  <button type="button" className="btn btn-dark" onClick={() => setShowSearchBar(false)}>
                    <i className="fa fa-fw fa-times-circle" />
                  </button>
                </div>
                <input
                  type="text"
                  className="form-control border-0"
                  placeholder={search.placeholder}
                  onChange={(e) => search.onChange(e.target.value)}
                  defaultValue={search.defaultValue}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
