// 主题：登录前用 config.js（叠加上次从后端拿到的缓存），登录后以后端「个性化」设置为准。
import { create } from 'zustand'
import { normalizeTheme, settings, type ThemeSettings } from '@/app/settings'

const CACHE_KEY = 'v2b_frontend'

interface FrontendCache {
  theme?: Partial<ThemeSettings>
  background_url?: string
}

function readCache(): FrontendCache {
  try {
    return (JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? '{}') as FrontendCache) ?? {}
  } catch {
    return {}
  }
}

interface ThemeState {
  theme: ThemeSettings
  /** 登录页背景图：config.js 优先，其次后端 frontend_background_url */
  backgroundUrl: string
  applyBackendFrontend: (frontend: Record<string, unknown>) => void
}

const cache = readCache()

export const useThemeStore = create<ThemeState>((set) => ({
  theme: normalizeTheme({ ...settings.theme, ...cache.theme }),
  backgroundUrl: settings.background_url || cache.background_url || '',
  applyBackendFrontend: (frontend) => {
    const theme = normalizeTheme({
      sidebar: frontend.frontend_theme_sidebar,
      header: frontend.frontend_theme_header,
      color: frontend.frontend_theme_color,
    })
    const background = typeof frontend.frontend_background_url === 'string' ? frontend.frontend_background_url : ''
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, background_url: background } satisfies FrontendCache))
    set({ theme, backgroundUrl: settings.background_url || background })
  },
}))
