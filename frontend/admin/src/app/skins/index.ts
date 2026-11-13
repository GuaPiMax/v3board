// 皮肤注册表（顶栏的主题按钮按这里的顺序列出）。新增一种风格：在这里登记，另见 types.ts 的 Skin
import { geek } from './geek'
import { illustration } from './illustration'
import type { Skin } from './types'

export const SKINS = { illustration, geek } satisfies Record<string, Skin>

export type SkinName = keyof typeof SKINS

export const isSkin = (ui: unknown): ui is SkinName => typeof ui === 'string' && Object.hasOwn(SKINS, ui)

export type { ChartThemePatch, Skin, SkinChart, SkinChartColors, SkinComponentConfig, SkinDarkMode, UiPreview } from './types'
