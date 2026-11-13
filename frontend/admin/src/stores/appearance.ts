// 界面外观：界面预设与暗黑模式。
//   - 界面预设（经典 / 各皮肤）存在浏览器里（localStorage v2b_ui），由顶栏的主题按钮切换，不需要在 config.js 里配置，
//     切换时不刷新页面；没选过时是经典（legacy）
//   - 暗黑模式与原版一致存在 cookie dark_mode（1 / 0），固定暗色的皮肤不看它
// <html> 上的 data-v2b-ui / data-v2b-dark 与 darkreader 的开关见 utils/darkMode
import { create } from 'zustand'
import { parseUiPreset, type UiPreset } from '@/app/uiPreset'
import { getCookie } from '@/utils/cookie'

const UI_KEY = 'v2b_ui'

function readUi(): UiPreset {
  try {
    return parseUiPreset(window.localStorage.getItem(UI_KEY))
  } catch {
    return 'legacy'
  }
}

export function saveUi(ui: UiPreset) {
  try {
    window.localStorage.setItem(UI_KEY, ui)
  } catch {
    // 浏览器禁止存储时只在本次打开期间生效
  }
}

interface AppearanceState {
  ui: UiPreset
  /** cookie dark_mode */
  dark: boolean
}

export const useAppearanceStore = create<AppearanceState>(() => ({
  ui: readUi(),
  dark: getCookie('dark_mode') === '1',
}))

/** 当前的界面预设（组件里用 useUi，切换时重新渲染） */
export const getUi = () => useAppearanceStore.getState().ui
export const useUi = () => useAppearanceStore((s) => s.ui)
