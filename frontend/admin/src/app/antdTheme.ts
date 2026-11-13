// antd 6 主题。界面预设（见 uiPreset.ts）：
//   - legacy（默认）：把组件观感调成原版 antd 3（原版 theme/*.css 由 antd 3 的色板算法重新着色），
//     token 表达不了的部分在 styles/antd3-compat.scss，同样只在 legacy 下生效
//   - 皮肤（app/skins）：主题由各皮肤定义，外框与装饰在 styles/skins/
// @ant-design/colors 的 generate() 与原版色板一致，例如 #0665d0 → hover #2a84de、active #004aab。
import { generate } from '@ant-design/colors'
import type { AppProps, ThemeConfig } from 'antd'
import type { ThemeColor } from './settings'
import type { UiPreset } from './uiPreset'
import { isSkin, SKINS, type SkinComponentConfig, type UiPreview } from './skins'

export const THEME_PRIMARY: Record<ThemeColor, string> = {
  default: '#0665d0',
  black: '#343a40',
  darkblue: '#3b5998',
  green: '#319795',
}

/**
 * antd 3 的组件不设置字体，而是继承父元素（body 的字体随主题不同：绿色主题会换成 antd 的字体栈；
 * 表格里继承 .ant-table 的 menlo）。antd 6 会在组件根节点写死 fontFamily，这里用 inherit 还原继承行为。
 */
export const FONT_FAMILY = 'inherit'

// 各预设共用：不加 hash class（DOM class 与原版一致）、CSS 变量前缀 --ant-
const BASE: ThemeConfig = { hashed: false, cssVar: { key: 'v2b' } }

/**
 * 组件默认属性（ConfigProvider 的组件配置）。各预设都需要：
 *   - 标签默认带边框（antd 6 默认无边框，浅灰的标签如节点倍率「1 x」、权限组与背景分不清；antd 6 观感下也带边框）
 *   - 分页默认不显示每页条数选择（antd 6 在总数超过 50 时自动显示，例如订单管理；原版只有部分表格显式打开，
 *     这是页面布局的一部分，各预设保持一致）
 * legacy 下另外还原 antd 3 的默认行为：
 *   - 抽屉的关闭按钮在标题右侧（antd 6 在左侧）；关闭后不把焦点还给打开它的按钮（antd 3 的抽屉不管理焦点，
 *     antd 6 还回去后按钮显示为焦点色，例如用户管理「过滤器」检索后）
 *   - 下拉选择的选项列表不用虚拟滚动（antd 3 是普通的可滚动列表，滚动条为系统样式）
 * 皮肤再合并各自的组件默认属性
 */
export function buildComponentConfig(ui: UiPreset): SkinComponentConfig {
  const shared = { tag: { variant: 'outlined' }, pagination: { showSizeChanger: false } } as const
  if (isSkin(ui)) return { ...shared, ...SKINS[ui].components }
  return {
    ...shared,
    drawer: { closable: { placement: 'end' }, focusable: { focusTriggerAfterClose: false } },
    virtual: false,
  }
}

/** <App> 的配置：legacy 下全局提示（message）距顶部 16px（antd 3 的位置，antd 6.6 默认 8px） */
export function buildAppConfig(ui: UiPreset): Pick<AppProps, 'message'> {
  return ui === 'legacy' ? { message: { top: 16 } } : {}
}

/**
 * dark：皮肤是否使用暗色版（见 utils/darkMode）。legacy 的暗黑模式由 darkreader 处理，不改 antd 主题；
 * 固定暗色的皮肤（dark: 'always'）始终是暗色
 */
export function buildAntdTheme(color: ThemeColor, ui: UiPreset = 'legacy', dark = false): ThemeConfig {
  const primary = THEME_PRIMARY[color]
  if (isSkin(ui)) {
    const skin = SKINS[ui]
    // 与其他预设相同的 BASE 放在最后，皮肤不能改掉
    return { ...skin.theme(primary, dark || skin.dark === 'always'), ...BASE }
  }
  return buildLegacyTheme(primary)
}

/**
 * 经典在顶栏主题按钮（layouts/UiSwitch）里的样子：antd 3 的白底、浅灰描边、4px 圆角，色块（主按钮：主题色的底色与描边）
 * 与勾为主题色。
 * 暗色版是 darkreader（选项见 utils/darkMode）实际转换出来的颜色：在经典的暗色页面上给同样的颜色取色
 */
export function legacyPreview(primary: string, dark: boolean): UiPreview {
  const darkAccent = LEGACY_DARK_PRIMARY[primary]
  const c = dark
    ? { ...LEGACY_DARK, accent: darkAccent.fill, accentLine: darkAccent.line, check: darkAccent.text }
    : { ...LEGACY_LIGHT, accent: primary, accentLine: primary, check: primary }
  return {
    background: c.background,
    color: c.color,
    border: `1px solid ${c.line}`,
    borderRadius: 4,
    accent: c.accent,
    accentBorder: `1px solid ${c.accentLine}`,
    accentRadius: 2,
    check: c.check,
  }
}

// 文字 rgba(0, 0, 0, 0.65) 在白底上的颜色是 #595959
const LEGACY_LIGHT = { background: '#ffffff', color: '#595959', line: '#d9d9d9' }
// darkreader 转换后的颜色（2026-09-26 在经典的暗色页面上取色）：白底 → #242525；文字 rgba(0, 0, 0, 0.65) →
// rgba(229, 224, 216, 0.65)，叠在转换后的白底上是 #a19f99；描边 #d9d9d9 → #454847
const LEGACY_DARK = { background: '#242525', color: '#a19f99', line: '#454847' }
// 四套主题色作为底色（fill）、描边（line）与文字（text）转换后的颜色
const LEGACY_DARK_PRIMARY: Record<string, { fill: string; line: string; text: string }> = {
  [THEME_PRIMARY.default]: { fill: '#1a5699', line: '#1b5ea9', text: '#62a9e4' },
  [THEME_PRIMARY.black]: { fill: '#363838', line: '#7d7466', text: '#c2bcb0' },
  [THEME_PRIMARY.darkblue]: { fill: '#3c4e75', line: '#435783', text: '#87a4c0' },
  [THEME_PRIMARY.green]: { fill: '#397a75', line: '#42918c', text: '#7dc9c3' },
}

/** #rrggbb → rgba(r, g, b, alpha)（antd 3 的 fade()） */
export function fade(hex: string, alpha: number) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildLegacyTheme(primary: string): ThemeConfig {
  const palette = generate(primary)
  // 聚焦：边框为色板第 5 级（与 hover 相同），外加 2px 的主题色 20% 光晕（原版 theme/*.css 中 .ant-input:focus 等）
  const focusShadow = `0 0 0 2px ${fade(primary, 0.2)}`
  return {
    ...BASE,
    token: {
      colorPrimary: primary,
      // 原版四套主题文件的 info 色都固定为 antd 3 默认的 #1890ff（不随主题色）：「处理中」状态点、
      // message 的加载中 / 信息图标、Modal.info 的图标
      colorInfo: '#1890ff',
      colorLink: primary,
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#f5222d',
      colorText: 'rgba(0, 0, 0, 0.65)',
      colorTextHeading: 'rgba(0, 0, 0, 0.85)',
      colorTextSecondary: 'rgba(0, 0, 0, 0.45)',
      colorTextDisabled: 'rgba(0, 0, 0, 0.25)',
      colorTextPlaceholder: '#bfbfbf',
      colorBorder: '#d9d9d9',
      colorBorderSecondary: '#e8e8e8',
      colorSplit: '#e8e8e8',
      colorFillAlter: '#fafafa',
      colorBgContainerDisabled: '#f5f5f5',
      colorBgMask: 'rgba(0, 0, 0, 0.45)',
      colorBgSpotlight: 'rgba(0, 0, 0, 0.75)',
      controlItemBgHover: palette[0],
      controlItemBgActive: palette[0],
      controlItemBgActiveHover: palette[0],
      controlOutline: fade(primary, 0.2),
      controlOutlineWidth: 2,
      borderRadius: 4,
      borderRadiusLG: 4,
      borderRadiusSM: 2,
      borderRadiusXS: 2,
      fontSize: 14,
      lineHeight: 1.5,
      // antd 3 的标题类文字（表头、弹窗标题等）都是 500
      fontWeightStrong: 500,
      fontFamily: FONT_FAMILY,
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.15)',
      // 抽屉阴影：antd 3 为单层 2px 8px（antd 6 是三层叠加，更深更宽）。token 名按抽屉位置命名（右侧抽屉阴影朝左）；
      // 这几个 token 在 antd 6.6 的样式里使用，但没有写进 AliasToken 类型
      ...({
        boxShadowDrawerRight: '-2px 0 8px rgba(0, 0, 0, 0.15)',
        boxShadowDrawerLeft: '2px 0 8px rgba(0, 0, 0, 0.15)',
        boxShadowDrawerUp: '0 2px 8px rgba(0, 0, 0, 0.15)',
        boxShadowDrawerDown: '0 -2px 8px rgba(0, 0, 0, 0.15)',
      } as object),
      motionDurationMid: '0.3s',
      motionDurationSlow: '0.3s',
    },
    components: {
      Button: {
        paddingInline: 15,
        fontWeight: 400,
        defaultShadow: '0 2px 0 rgba(0, 0, 0, 0.015)',
        primaryShadow: '0 2px 0 rgba(0, 0, 0, 0.045)',
        dangerShadow: '0 2px 0 rgba(0, 0, 0, 0.045)',
      },
      Input: {
        hoverBorderColor: palette[4],
        activeBorderColor: palette[4],
        activeShadow: focusShadow,
        // antd 3：padding 4px 11px + 固定高度 32px（高度在 antd3-compat.scss 里补）
        paddingBlock: 4,
        paddingInline: 11,
      },
      Select: {
        hoverBorderColor: palette[4],
        activeBorderColor: palette[4],
        activeOutlineColor: fade(primary, 0.2),
        optionSelectedBg: '#fafafa',
        optionActiveBg: palette[0],
        optionSelectedFontWeight: 600,
        // 下拉选项：antd 3 为 5px 12px 内边距 + 22px 行高（antd 6 按 1.5 倍行高算出 21px + 5.5px，文字落在半像素上）
        optionPadding: '5px 12px',
        optionLineHeight: '22px',
        multipleItemBg: '#fafafa',
        // antd 3 各尺寸的选择框圆角都是 4px
        borderRadiusSM: 4,
      },
      Table: {
        headerBg: '#fafafa',
        headerColor: 'rgba(0, 0, 0, 0.85)',
        headerSplitColor: 'transparent',
        borderColor: '#e8e8e8',
        rowHoverBg: palette[0],
        rowSelectedBg: '#fafafa',
        headerBorderRadius: 4,
        cellPaddingBlock: 16,
        cellPaddingInline: 16,
        // 排序列：表头悬停 #f2f2f2、已排序 #f5f5f5，单元格 rgba(0,0,0,.01)
        headerSortHoverBg: '#f2f2f2',
        headerSortActiveBg: '#f5f5f5',
        bodySortBg: 'rgba(0, 0, 0, 0.01)',
      },
      Modal: {
        titleLineHeight: 1.375,
        titleColor: 'rgba(0, 0, 0, 0.85)',
      },
      Tag: {
        defaultBg: '#fafafa',
        // 原版主题文件的 .ant-tag 规则把行高覆盖成了 1.5（12px 字号即 18px，标签高 20px），圆角 4px
        lineHeightSM: 1.5,
        borderRadiusSM: 4,
      },
      Message: {
        contentPadding: '10px 16px',
      },
      Switch: {
        // antd 3 默认尺寸 44×22、滑块 18px，文字距两侧 6px / 24px（antd 6 按 14px × 1.5 行高算出 42×21、滑块 17px）
        trackHeight: 22,
        trackMinWidth: 44,
        handleSize: 18,
        innerMinMargin: 6,
        innerMaxMargin: 24,
        trackMinWidthSM: 28,
      },
    },
  }
}
