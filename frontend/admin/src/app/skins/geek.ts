// 极客风：参考 antd 官网首页「定制主题」的「极客」示例（ant-design 仓库 .dumi/pages/index/components/ThemePreview/
// previewThemes/geekTheme.ts，MIT）：近黑的墨绿底色、霓虹绿 #39ff14、直角、发光的描边、暗色算法。
// 与示例的区别（按后台的信息密度往「硬朗简洁」收敛）：
//   - 霓虹绿固定（不随四套主题色），固定暗色（顶栏不显示暗黑切换）
//   - 正文用柔和的绿灰（示例所有文字都是霓虹绿并发光）；霓虹绿与发光只用在标题、链接、选中项、聚焦与主按钮上
//   - 静止时的描边是暗绿色细线（线宽 1，示例是 2px 的霓虹绿），悬停时换成霓虹绿，聚焦、选中与浮层再加上发光
//   - 状态色也用霓虹色系：成功为霓虹绿，信息青、警告琥珀、错误洋红
// 外框（侧边栏、顶栏、内容块等）与组件上的描边、发光在 styles/skins/_geek.scss
import { theme, type MappingAlgorithm } from 'antd'
import type { Skin } from './types'

/** 霓虹绿（不随主题色） */
export const NEON = '#39ff14'

/** 状态色（霓虹色系） */
const STATUS = { success: NEON, info: '#00d8ff', warning: '#ffc400', error: '#ff3d6e' }

/** 基础颜色（styles/skins/_geek.scss 的 --v2b-page-bg 等与这里对应） */
const C = {
  // 正文：柔和的绿灰（在内容块上对比度 11.8）
  ink: '#b4d4ad',
  paper: '#030603',
  card: '#07120a',
  elevated: '#0b190d',
  // 表头、内容块的标题栏、输入框的前后置区
  alt: '#0d1f10',
  // 禁用、只读的输入框
  sunken: '#050c06',
  // 控件与内容块的描边（压暗的霓虹绿）；表格行、分隔线用更暗的一级（在浮层、标题栏上对比度也有 1.35 以上）
  line: '#1d5a17',
  lineSoft: '#173a12',
  placeholder: '#5f7f5a',
  // 霓虹绿底上的文字（主按钮、选中的复选框等；白字在霓虹绿上看不清）
  onNeon: '#030603',
  neonHover: '#6bff4d',
  neonActive: '#2cad14',
  // 霓虹绿叠在内容块 / 浮层上的不透明色（固定列横向滚动时要盖住下面的内容，不能用半透明）
  rowHover: '#0a200b',
  optionActive: '#0f2b0e',
  optionSelected: '#13420e',
  sortActive: '#113110',
}

/** 等宽字体（与 styles/skins/_geek.scss 的 $mono 相同） */
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace"

const glow = (blur: number, alpha: number) => `0 0 ${blur}px rgba(57, 255, 20, ${alpha})`

/**
 * 暗色算法按暗色色板把主色、链接色、状态色压暗（#39ff14 → #33dc14，官网示例里按钮等也是压暗后的颜色；
 * 状态点、通知图标会和旁边的霓虹绿成了两种绿），这里在暗色算法之后换回原样的颜色
 */
const keepNeon: MappingAlgorithm = (_seed, map) => ({
  ...map!,
  colorPrimary: NEON,
  colorPrimaryHover: C.neonHover,
  colorPrimaryActive: C.neonActive,
  colorPrimaryText: NEON,
  colorPrimaryTextHover: C.neonHover,
  colorPrimaryTextActive: C.neonActive,
  // 按钮、开关等键盘聚焦时的描边（压暗后的 #1f5b14 像多了一圈暗框）
  colorPrimaryBorder: C.neonActive,
  colorLink: NEON,
  colorLinkHover: C.neonHover,
  colorLinkActive: C.neonActive,
  colorSuccess: STATUS.success,
  colorSuccessText: STATUS.success,
  colorInfo: STATUS.info,
  colorInfoText: STATUS.info,
  colorWarning: STATUS.warning,
  colorWarningText: STATUS.warning,
  colorError: STATUS.error,
  colorErrorText: STATUS.error,
})

export const geek: Skin = {
  label: '极客',
  // 近黑底、霓虹绿描边与发光、直角、等宽字体（固定暗色，不看 dark）
  preview: () => ({
    background: C.paper,
    color: NEON,
    border: `1px solid ${NEON}`,
    borderRadius: 0,
    boxShadow: glow(10, 0.45),
    fontFamily: MONO,
    textShadow: '0 0 6px rgba(57, 255, 20, 0.55)',
    accent: NEON,
    accentRadius: 0,
    check: NEON,
  }),
  dark: 'always',
  theme: () => ({
    algorithm: [theme.darkAlgorithm, keepNeon],
    token: {
      colorPrimary: NEON,
      colorLink: NEON,
      colorSuccess: STATUS.success,
      colorInfo: STATUS.info,
      colorWarning: STATUS.warning,
      colorError: STATUS.error,
      // 预设色的标签（用户列表的「正常 / 封禁」、已用流量、到期时间）与状态色一致
      green: STATUS.success,
      red: STATUS.error,
      colorTextBase: C.ink,
      colorText: C.ink,
      // 标题（弹窗、抽屉、表头等）用霓虹绿
      colorTextHeading: NEON,
      colorTextPlaceholder: C.placeholder,
      // 下拉箭头、清除图标、禁用文字（默认是正文色的 25%，在墨绿底上只有 1.8:1）
      colorTextQuaternary: 'rgba(180, 212, 173, 0.4)',
      colorBgBase: C.paper,
      colorBgLayout: C.paper,
      colorBgContainer: C.card,
      colorBgElevated: C.elevated,
      // 文字提示的底色（默认由底色推算，是亮一些的绿色）
      colorBgSpotlight: C.elevated,
      colorBgContainerDisabled: C.sunken,
      // 遮罩：子抽屉会再叠一层，太深时下面的抽屉看不出来
      colorBgMask: 'rgba(0, 0, 0, 0.6)',
      colorBorder: C.line,
      // 禁用的输入框描边（默认由底色推算，比正常的描边还亮）
      colorBorderDisabled: C.line,
      colorBorderSecondary: C.lineSoft,
      colorSplit: C.lineSoft,
      // 下拉菜单、选项的悬停与选中
      controlItemBgHover: C.optionActive,
      controlItemBgActive: C.optionSelected,
      controlItemBgActiveHover: C.optionSelected,
      controlOutline: 'rgba(57, 255, 20, 0.3)',
      lineWidth: 1,
      lineWidthFocus: 2,
      borderRadius: 0,
      borderRadiusLG: 0,
      borderRadiusSM: 0,
      borderRadiusXS: 0,
      borderRadiusOuter: 0,
      fontWeightStrong: 600,
      // 与其他预设一样继承页面字体（见 antdTheme.ts 的 FONT_FAMILY）
      fontFamily: 'inherit',
      // 浮层：霓虹绿的外发光（描边见 _antd.scss）
      boxShadow: glow(18, 0.22),
      boxShadowSecondary: glow(14, 0.22),
      boxShadowTertiary: glow(8, 0.18),
    },
    components: {
      Button: {
        fontWeight: 500,
        primaryColor: C.onNeon,
        defaultShadow: 'none',
        primaryShadow: glow(10, 0.45),
        // 危险按钮：洋红底上也用深色字（白字对比度只有 3.4）
        dangerColor: C.onNeon,
        dangerShadow: '0 0 10px rgba(255, 61, 110, 0.45)',
      },
      // 选中后的对勾、单选的圆点画在霓虹绿上，用深色
      Checkbox: { colorWhite: C.onNeon },
      Radio: { radioColor: C.onNeon, buttonSolidCheckedColor: C.onNeon },
      // 开关的滑块：关闭时是正文色，打开时在 _geek.scss 换成深色（霓虹绿上看不清浅色）；关闭时的轨道保持
      // 正文色 25% 的深色（全局的 colorTextQuaternary 调亮后，浅色滑块、「暗」字与轨道分不开）
      Switch: { handleBg: C.ink, colorTextQuaternary: 'rgba(180, 212, 173, 0.25)' },
      DatePicker: { colorTextLightSolid: C.onNeon },
      Tooltip: { colorTextLightSolid: NEON },
      Table: {
        headerBg: C.alt,
        headerSplitColor: 'transparent',
        rowHoverBg: C.rowHover,
        headerBorderRadius: 0,
        headerSortActiveBg: C.sortActive,
        headerSortHoverBg: C.sortActive,
        bodySortBg: 'transparent',
        filterDropdownBg: C.elevated,
        filterDropdownMenuBg: C.elevated,
        rowSelectedBg: C.rowHover,
        rowSelectedHoverBg: C.optionActive,
      },
      Select: {
        optionActiveBg: C.optionActive,
        optionSelectedBg: C.optionSelected,
        optionSelectedColor: NEON,
        multipleItemBg: C.alt,
      },
      Input: { addonBg: C.alt },
      Tabs: {
        itemColor: C.ink,
        itemSelectedColor: NEON,
        itemHoverColor: C.neonHover,
        itemActiveColor: C.neonActive,
        inkBarColor: NEON,
      },
      Modal: { titleColor: NEON },
      // 通知的标题、全局提示的文字用正文色（霓虹绿也是成功色，错误通知的标题用它像成功）
      Notification: { colorTextHeading: C.ink },
      Message: { colorTextHeading: C.ink },
    },
  }),
  components: {
    tooltip: { arrow: false },
  },
  // 仪表盘图表：系列用霓虹色系（与状态色一致），文字、坐标轴、提示框带绿色（dark）；排行的柱子照 antd 官网「极客」示例的
  // 进度条画——半透明霓虹绿底槽、霓虹绿填充，直角、填充带外发光；收入图的数据点是像素风的小方块；文字用等宽字体，
  // 提示框直角、霓虹描边带发光（theme）
  chart: {
    theme: () => ({
      textStyle: { fontFamily: MONO },
      bar: {
        barWidth: 12,
        showBackground: true,
        backgroundStyle: { color: 'rgba(57, 255, 20, 0.18)', borderRadius: 0 },
        itemStyle: { color: NEON, borderRadius: 0, shadowBlur: 10, shadowColor: 'rgba(57, 255, 20, 0.6)' },
      },
      line: { symbol: 'rect', symbolSize: 5, lineStyle: { width: 2 } },
      // 坐标轴文字单独写字体：containLabel 按坐标轴自己的字体量宽度，只写在全局 textStyle 时按默认字体量，等宽字体更宽，名称被裁
      categoryAxis: { axisLabel: { fontFamily: MONO } },
      valueAxis: { axisLabel: { fontFamily: MONO }, splitLine: { lineStyle: { type: 'dashed' } } },
      tooltip: {
        borderWidth: 1,
        borderRadius: 0,
        shadowBlur: 12,
        shadowColor: 'rgba(57, 255, 20, 0.45)',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        textStyle: { fontFamily: MONO },
      },
    }),
    dark: {
      palette: [NEON, '#00d8ff', '#ffc400', '#ff3d6e', '#b388ff', '#ff8a3d', '#2ee6b8', '#e6ff3d', '#ff66d9'],
      text: 'rgba(180, 212, 173, 0.72)',
      textStrong: 'rgba(180, 212, 173, 0.95)',
      axis: 'rgba(57, 255, 20, 0.35)',
      split: 'rgba(57, 255, 20, 0.1)',
      inactive: 'rgba(180, 212, 173, 0.3)',
      tooltipBg: 'rgba(11, 25, 13, 0.96)',
      tooltipBorder: NEON,
    },
  },
}
