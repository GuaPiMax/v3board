import type { ConfigProviderProps, ThemeConfig } from 'antd'

/**
 * 皮肤的暗色：
 *   - toggle：跟随顶栏的暗黑模式切换（cookie dark_mode，与 legacy 共用），暗色版由皮肤自己设计
 *   - always：固定暗色，顶栏不显示切换按钮
 */
export type SkinDarkMode = 'toggle' | 'always'

/** 皮肤给 ConfigProvider 的组件默认属性（与各预设共用的标签边框、分页设置合并） */
export type SkinComponentConfig = Omit<
  ConfigProviderProps,
  'theme' | 'locale' | 'children' | 'prefixCls' | 'iconPrefixCls'
>

/** 暗色版图表的底色（v5 主题上换成暗底上的文字 / 坐标轴 / 提示框，见 components/echarts/skinChartTheme），没写的沿用默认值 */
export interface SkinChartColors {
  /** 系列配色（默认与 v5 主题相同） */
  palette?: string[]
  text?: string
  textStrong?: string
  axis?: string
  split?: string
  /** 图例里关掉的系列 */
  inactive?: string
  tooltipBg?: string
  tooltipBorder?: string
}

/** ECharts 主题对象的一部分（按键深合并到 v5 主题上，例如 bar / line 系列的默认样式、坐标轴、提示框） */
export type ChartThemePatch = Record<string, unknown>

/**
 * 仪表盘图表（ECharts）的皮肤：
 *   - dark：暗色版的底色（见 SkinChartColors）
 *   - theme：这种风格的图表样式，primary 为当前主题色、dark 为是否暗色（与 Skin.theme 相同），叠在最上面
 */
export interface SkinChart {
  dark?: SkinChartColors
  theme?: (primary: string, dark: boolean) => ChartThemePatch
}

/**
 * 顶栏主题按钮（layouts/UiSwitch）里这一项的样子：按这种风格自己的配色画成一张小卡片，与当前风格无关。
 * 颜色写成不透明的 #rrggbb（单测按它算对比度）
 */
export interface UiPreview {
  background: string
  /** 名称的文字色 */
  color: string
  /** 描边（CSS border 简写） */
  border: string
  borderRadius: number
  boxShadow?: string
  fontFamily?: string
  fontWeight?: number
  textShadow?: string
  /** 名称左边的主色色块 */
  accent: string
  accentBorder?: string
  accentRadius: number
  /** 当前项的勾 */
  check: string
}

/**
 * 皮肤：在 antd 6 的默认观感之上整体换肤，布局不变。每种皮肤由三部分组成：
 *   - 这里的定义：antd 主题与组件默认属性
 *   - styles/skins/_<名字>.scss：外框与组件装饰用到的 --v2b-* 变量（亮色、暗色各一组）与特有的装饰
 *   - styles/skins/index.scss 的 $skin-scope 里登记一行
 */
export interface Skin {
  /** 顶栏主题按钮里的名称 */
  label: string
  /** 顶栏主题按钮里的样子：primary 为当前主题色，dark 为当前是否开着暗黑模式（与 theme 相同） */
  preview: (primary: string, dark: boolean) => UiPreview
  dark: SkinDarkMode
  /** antd 主题：primary 为当前主题色（四套主题色之一，皮肤可以不用），dark 为是否暗色 */
  theme: (primary: string, dark: boolean) => ThemeConfig
  components?: SkinComponentConfig
  chart?: SkinChart
}
