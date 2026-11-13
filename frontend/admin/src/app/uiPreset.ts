// 界面预设（顶栏的主题按钮切换，存在浏览器里，见 stores/appearance）：
//   - legacy（默认）：原版 antd 3 观感，像素级还原
//   - 皮肤（见 app/skins：illustration 插画、geek 极客）：在 antd 6 的默认观感之上整体换肤，布局不变
// 页面里按 ui === 'legacy' / !== 'legacy' 区分 antd 3 与 antd 6 的行为
import { legacyPreview } from './antdTheme'
import { isSkin, SKINS, type SkinName, type UiPreview } from './skins'

export type UiPreset = 'legacy' | SkinName

/** 不认识的值按 legacy 处理（包括已经去掉的 modern：它和 legacy 看起来没有差别） */
export const parseUiPreset = (ui: unknown): UiPreset => (isSkin(ui) ? ui : 'legacy')

export interface UiPresetOption {
  value: UiPreset
  label: string
  preview: (primary: string, dark: boolean) => UiPreview
}

/** 顶栏主题按钮里的选项：经典在前，皮肤按注册表的顺序 */
export const UI_PRESET_OPTIONS: UiPresetOption[] = [
  { value: 'legacy', label: '经典', preview: legacyPreview },
  ...(Object.keys(SKINS) as SkinName[]).map((name) => ({
    value: name,
    label: SKINS[name].label,
    preview: SKINS[name].preview,
  })),
]
