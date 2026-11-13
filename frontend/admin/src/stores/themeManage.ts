// 主题配置（原版 dva model theme，模块 O8oq）：与原版一样是全局状态，离开页面不重置
// （再次进入时直接显示上次读取的主题，同时重新读取）。保存主题设置成功后重新读取主题列表（不等待）
import { create } from 'zustand'
import { getThemeConfig, getThemes, saveThemeConfig } from '@/api/services/theme'
import type { ThemeInfo } from '@/api/types'

interface ThemeManageState {
  /** 主题目录名 → 主题信息（读取前为空，页面显示加载中） */
  themes: Record<string, ThemeInfo>
  /** 当前使用的主题 */
  active?: string
  getThemesLoading: boolean
  getThemeConfigLoading: boolean
  saveThemeConfigLoading: boolean
  getThemes: () => Promise<void>
  getThemeConfig: (name: string) => Promise<Record<string, string> | undefined>
  /** config：设置内容 JSON 的 base64；complete：保存成功后调用 */
  saveThemeConfig: (config: string, name: string, complete?: () => void) => Promise<void>
}

export const useThemeManageStore = create<ThemeManageState>((set, get) => ({
  themes: {},
  active: undefined,
  getThemesLoading: false,
  getThemeConfigLoading: false,
  saveThemeConfigLoading: false,

  getThemes: async () => {
    set({ getThemesLoading: true })
    const res = await getThemes()
    set({ getThemesLoading: false })
    if (res.code !== 200) return
    set({ themes: res.data?.themes ?? {}, active: res.data?.active })
  },

  getThemeConfig: async (name) => {
    set({ getThemeConfigLoading: true })
    const res = await getThemeConfig(name)
    set({ getThemeConfigLoading: false })
    if (res.code !== 200) return undefined
    return res.data
  },

  saveThemeConfig: async (config, name, complete) => {
    set({ saveThemeConfigLoading: true })
    const res = await saveThemeConfig(config, name)
    set({ saveThemeConfigLoading: false })
    if (res.code !== 200) return
    void get().getThemes()
    complete?.()
  },
}))
