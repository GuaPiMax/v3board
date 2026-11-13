// 暗黑模式：与原版一致使用 darkreader + cookie dark_mode（1 / 0）。
// darkreader 按需加载（不在入口包里）：开着暗黑模式时首屏渲染前先加载它，其余情况在空闲时预加载（见 app/router）。
// 皮肤（app/skins）不用 darkreader，用自己设计的暗色版：cookie 相同，暗色时 <html> 带 data-v2b-dark，antd 换成暗色主题；
// 固定暗色的皮肤（dark: 'always'）始终是暗色，顶栏不显示切换按钮。
// 界面预设可以在运行中切换（顶栏的主题按钮，见 layouts/UiSwitch）：<html> 的 data-v2b-ui / data-v2b-dark 与 darkreader 的开关
// 由 App 在提交时同步（useSyncAppearance），与 antd 的新主题在同一帧生效
import { useLayoutEffect } from 'react'
import type { UiPreset } from '@/app/uiPreset'
import { isSkin, SKINS } from '@/app/skins'
import { getUi, saveUi, useAppearanceStore } from '@/stores/appearance'
import { setCookie } from './cookie'

const OPTIONS = { brightness: 100, contrast: 90, sepia: 10 }
// 顶栏主题按钮里的选项按各自的风格显示（行内样式），不让 darkreader 转换（它为取色器这类场景提供的设置）；
// 其余字段为空，与不传时相同
const FIXES = {
  invert: [],
  css: '',
  ignoreInlineStyle: ['.v2b-ui-option', '.v2b-ui-option *'],
  ignoreImageAnalysis: [],
  disableStyleSheetsProxy: false,
  ignoreCSSUrl: [],
}

const fixedDark = (ui: UiPreset) => isSkin(ui) && SKINS[ui].dark === 'always'
/** 皮肤是否为暗色版（legacy 始终为 false：它的暗黑模式由 darkreader 处理，不换 antd 主题） */
const skinDark = (ui: UiPreset, dark: boolean) => isSkin(ui) && (dark || SKINS[ui].dark === 'always')
/** legacy 开着暗黑模式时启用 darkreader */
const readerOn = (ui: UiPreset, dark: boolean) => !isSkin(ui) && dark

/** 当前皮肤固定暗色（顶栏不显示暗黑模式切换按钮） */
export const useDarkModeFixed = () => useAppearanceStore((s) => fixedDark(s.ui))
/** 顶栏暗黑按钮的图标：固定暗色的皮肤始终为暗色 */
export const useDarkMode = () => useAppearanceStore((s) => fixedDark(s.ui) || s.dark)
export const useSkinDark = () => useAppearanceStore((s) => skinDark(s.ui, s.dark))

let darkreader: Promise<typeof import('darkreader')> | undefined
function loadDarkReader() {
  if (!darkreader) {
    darkreader = import('darkreader').then((module) => {
      module.setFetchMethod(window.fetch)
      return module
    })
    // 下载失败时允许下次重新下载
    darkreader.catch(() => {
      darkreader = undefined
    })
  }
  return darkreader
}

/** 皮肤不需要 darkreader，不预加载（切到 legacy 的暗色时再下载，见 switchUi） */
export const preloadDarkReader = () => (isSkin(getUi()) ? Promise.resolve() : loadDarkReader().catch(() => undefined))

// darkreader 的开关：wanted 为最近一次要求的状态（下载期间又关掉时不再启用）
let readerWanted = false
let readerEnabled = false
async function syncDarkReader(on: boolean) {
  readerWanted = on
  if (on === readerEnabled) return
  if (!on) {
    readerEnabled = false
    ;(await darkreader)?.disable()
    return
  }
  const module = await loadDarkReader()
  if (!readerWanted || readerEnabled) return
  module.enable(OPTIONS, FIXES)
  readerEnabled = true
}

function applyAppearance(ui: UiPreset, dark: boolean) {
  const html = document.documentElement
  html.dataset.v2bUi = ui
  if (skinDark(ui, dark)) html.dataset.v2bDark = ''
  else delete html.dataset.v2bDark
  return syncDarkReader(readerOn(ui, dark))
}

/** 首屏渲染前调用，开着暗黑模式时等 darkreader 生效后再渲染，避免闪烁 */
export function applyInitialAppearance() {
  const { ui, dark } = useAppearanceStore.getState()
  return applyAppearance(ui, dark)
}

/** App 里调用：界面预设或暗黑模式变化时，在提交时同步 <html> 的属性与 darkreader */
export function useSyncAppearance() {
  const ui = useAppearanceStore((s) => s.ui)
  const dark = useAppearanceStore((s) => s.dark)
  useLayoutEffect(() => {
    // darkreader 下载失败时保持亮色
    applyAppearance(ui, dark).catch(() => undefined)
  }, [ui, dark])
}

export async function toggleDarkMode() {
  const { ui, dark } = useAppearanceStore.getState()
  if (fixedDark(ui)) return
  // legacy：与原版一样先下载好 darkreader 再切换（下载失败时不切换）
  if (!dark && !isSkin(ui)) await loadDarkReader()
  setCookie('dark_mode', dark ? 0 : 1)
  useAppearanceStore.setState({ dark: !dark })
}

/** 切换界面预设（顶栏的主题按钮），保存在浏览器里 */
export async function switchUi(next: UiPreset) {
  const { ui, dark } = useAppearanceStore.getState()
  if (next === ui) return
  // 切到 legacy 且开着暗黑模式：先下载好 darkreader，切换时直接启用，不闪一下亮色（下载失败时照常切换，显示亮色）
  if (readerOn(next, dark)) await loadDarkReader().catch(() => undefined)
  saveUi(next)
  useAppearanceStore.setState({ ui: next })
}
