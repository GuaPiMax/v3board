// 插画风：参考 antd 官网首页「定制主题」的「插画」示例（ant-design 仓库 .dumi/pages/index/components/ThemePreview/
// previewThemes/illustrationTheme.ts，MIT）：米白底色、深色描边、错位实色阴影、大圆角、粗体按钮。
// 与示例的区别：
//   - 主色跟随四套主题色（示例固定绿色），成功 / 错误 / 信息色取示例配色，警告色加深一些（示例的 #FFD93D 上看不清「!」）
//   - 按后台的信息密度收敛：线宽 2（示例 3）、控件高 36（示例 40）、字号 14（示例 15）；表格与分隔线用细线
//   - 另有暗色版：深炭灰底、浅米色文字、暗一些的米色描边，错位阴影与描边同色（与亮色版一样）
// 外框（侧边栏、顶栏、内容块等）与组件上的描边、错位阴影在 styles/skins/_illustration.scss
import { generate, presetDarkPalettes, presetPalettes } from '@ant-design/colors'
import { theme } from 'antd'
import { luminance, toHsl, withLightness } from './color'
import type { Skin } from './types'

/** 亮色 / 暗色两组基础颜色（styles/skins/_illustration.scss 的 --v2b-page-bg 等与这里对应） */
const PALETTE = {
  light: {
    ink: '#2C2C2C',
    outline: '#2C2C2C',
    paper: '#FFF9F0',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    alt: '#FFF4E6',
    line: '#E6DFD3',
    shadow: '#2C2C2C',
    placeholder: '#8C877F',
    spotlight: '#3A3733',
    disabled: '#F6EEE2',
  },
  dark: {
    ink: '#EFE8DC',
    outline: '#B3A999',
    paper: '#1F1D1A',
    card: '#2A2724',
    elevated: '#322E2A',
    alt: '#34302B',
    line: '#48433D',
    // 错位阴影与描边同色（与亮色版一样）；纯黑在深炭灰底上几乎看不出来
    shadow: '#B3A999',
    placeholder: '#8F887D',
    spotlight: '#141210',
    disabled: '#2E2B27',
  },
}

/**
 * 仪表盘收入图各条线的配色：色相与原版的 v5 配色一一对应（收款金额仍是红色等），换成 antd 预设色里更饱和的一档；
 * 亮色取 6 号，暗色取暗色色板里亮一级的 7 号（在深底上更醒目）
 */
const CHART_SERIES = ['geekblue', 'green', 'gold', 'red', 'cyan', 'lime', 'volcano', 'purple', 'magenta'] as const

/**
 * 暗色版的主色：暗色算法会把主色再压暗，默认蓝、黑色、深蓝主题的主色在暗底上几乎看不见（对比度 1.2–2.2），
 * 亮度不够时提到 0.55（色相不变）作为按钮等的底色；链接、图标、选中的标签页等文字用更亮的一级（0.72，悬停 0.8，
 * 蓝色在同样的亮度下显得暗，0.72 才能让四套主题色都达到 4.5 的对比度）
 */
export function darkAccents(primary: string) {
  const fill = luminance(primary) < 0.2 ? withLightness(primary, Math.max(toHsl(primary)[2], 0.55), 0.18) : primary
  return {
    fill,
    link: withLightness(primary, 0.72, 0.18),
    linkHover: withLightness(primary, 0.8, 0.18),
    linkActive: withLightness(primary, 0.64, 0.18),
  }
}

export const illustration: Skin = {
  label: '插画',
  // 米白底（暗色为深炭灰）、深色粗描边、错位实色阴影、圆角、粗体，色块为主色
  preview: (primary, dark) => {
    const c = dark ? PALETTE.dark : PALETTE.light
    return {
      background: c.paper,
      color: c.ink,
      border: `2px solid ${c.outline}`,
      borderRadius: 8,
      boxShadow: `3px 3px 0 ${c.shadow}`,
      fontWeight: 600,
      accent: dark ? darkAccents(primary).fill : primary,
      accentBorder: `2px solid ${c.outline}`,
      accentRadius: 4,
      check: c.ink,
    }
  },
  dark: 'toggle',
  theme: (primary, dark) => {
    const c = dark ? PALETTE.dark : PALETTE.light
    const accent = dark ? darkAccents(primary) : undefined
    const link = accent?.link ?? primary
    // 主题色的浅色（色板第 1、2 级）：表头、行悬停、下拉选中项、排序列；暗色版用暖灰（主题色的深色偏冷）
    const palette = generate(primary)
    const [tint, tint2] = palette
    const offset = (size: number) => `${size}px ${size}px 0 ${c.shadow}`
    return {
      algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: accent?.fill ?? primary,
        colorLink: link,
        // 链接悬停：亮色下变深（antd 默认变浅，在浅蓝的行悬停底色上看不清），暗色下变亮
        colorLinkHover: accent?.linkHover ?? palette[6],
        colorLinkActive: accent?.linkActive ?? palette[7],
        colorInfo: '#4DABF7',
        colorSuccess: '#51CF66',
        colorWarning: '#FAB005',
        colorError: '#FA5252',
        colorTextBase: c.ink,
        colorText: c.ink,
        // 占位文字：antd 默认是文字色的 25%，在米白、炭灰底上太淡
        colorTextPlaceholder: c.placeholder,
        colorBgBase: c.paper,
        colorBgContainer: c.card,
        // 弹窗、下拉等浮层（默认由页面底色推算，是米白色）
        colorBgElevated: c.elevated,
        // 文字提示的底色（默认半透明，会透出下面的描边；暗色下由底色推算出的是偏黄的卡其色）
        colorBgSpotlight: c.spotlight,
        // 禁用的输入框等（默认由文字色推算，是冷灰）
        colorBgContainerDisabled: c.disabled,
        colorBorder: c.outline,
        colorBorderSecondary: c.line,
        colorSplit: c.line,
        lineWidth: 2,
        lineWidthBold: 2,
        // 聚焦框：antd 按线宽的倍数推算，线宽 2 时是 6px，太重
        lineWidthFocus: 2,
        borderRadius: 12,
        borderRadiusLG: 16,
        borderRadiusSM: 8,
        controlHeight: 36,
        controlHeightSM: 30,
        // 与页面里的原生输入框（.form-control）同高
        controlHeightLG: 40,
        fontSize: 14,
        fontWeightStrong: 600,
        // 与 legacy 一样继承页面字体（见 antdTheme.ts 的 FONT_FAMILY）
        fontFamily: 'inherit',
        // 浮层：错位实色阴影（描边见 _antd.scss）
        boxShadow: offset(4),
        boxShadowSecondary: offset(4),
        boxShadowTertiary: offset(2),
      },
      components: {
        Button: {
          fontWeight: 600,
          defaultShadow: offset(3),
          primaryShadow: offset(3),
          dangerShadow: offset(3),
          // 默认按钮悬停、按下时描边保持深色，只有文字变成主色（antd 默认描边也变成主色，按钮组「过滤器 | 操作」
          // 的外框与中缝会断开一段）
          defaultHoverBorderColor: c.outline,
          defaultActiveBorderColor: c.outline,
          // 按钮组里主按钮的分隔线（默认是浅一级的主色，与描边不一致）
          groupBorderColor: c.outline,
        },
        // 18px 的复选框用 8px 圆角就成了圆形，与单选框分不清
        Checkbox: { borderRadiusSM: 4 },
        Table: {
          headerBg: dark ? c.alt : tint,
          headerSplitColor: 'transparent',
          rowHoverBg: dark ? '#36312B' : tint,
          // 表头贴着内容块的直边，圆角处会露出缺口（外层内容块已经裁成圆角）
          headerBorderRadius: 0,
          headerSortActiveBg: dark ? '#423C34' : tint2,
          headerSortHoverBg: dark ? '#423C34' : tint2,
          bodySortBg: 'transparent',
          // 表头筛选浮层与其他浮层同色
          filterDropdownBg: c.elevated,
          filterDropdownMenuBg: c.elevated,
          lineWidth: 1,
          // 暗色下排序箭头等用亮一级的主色
          ...(accent && { colorPrimary: link }),
        },
        Divider: { lineWidth: 1 },
        Select: {
          // 选项：悬停、选中、选中且悬停三种底色（最后一种 antd 用 controlItemBgActiveHover）
          optionActiveBg: dark ? '#3A352F' : c.alt,
          optionSelectedBg: dark ? '#433D36' : tint,
          controlItemBgActiveHover: dark ? '#4A433B' : tint2,
          // 选项与 antd 默认一样高 32px（跟着控件高度变成 36px 后，订单「分配订单」的周期列表少显示一项）
          optionHeight: 32,
          optionPadding: '5px 12px',
          // 多选的已选项：暖色底（描边在 _antd.scss，antd 的 Select 不读 multipleItemBorderColor）
          multipleItemBg: c.alt,
        },
        Input: { addonBg: c.alt },
        Tooltip: { borderRadius: 8 },
        ...(accent && {
          Tabs: {
            itemSelectedColor: link,
            itemHoverColor: accent.linkHover,
            itemActiveColor: accent.linkActive,
            inkBarColor: link,
          },
          Pagination: { itemActiveColor: link, itemActiveColorHover: accent.linkHover },
          // 单选按钮组（工单「已开启 / 已关闭」）选中项的文字与描边
          Radio: { colorPrimary: link, colorPrimaryHover: accent.linkHover, colorPrimaryActive: accent.linkActive },
        }),
      },
    }
  },
  components: {
    tooltip: { arrow: false },
  },
  // 仪表盘图表：排行的柱子照 antd 官网「插画」示例的进度条画——胶囊形底槽（主色的浅色，暗色为与卡片底混合的深色）、
  // 深色描边与实色错位阴影，填充为主色、带同样的描边（描边连成一圈，填充末端是圆头）；收入图的线条加粗、数据点带描边；
  // 坐标轴、图例、提示框（卡片样式：描边、圆角、错位阴影）用插画的颜色
  chart: {
    theme: (primary, dark) => {
      const c = dark ? PALETTE.dark : PALETTE.light
      const fill = dark ? darkAccents(primary).fill : primary
      const rail = dark ? generate(primary, { theme: 'dark', backgroundColor: c.card })[1] : generate(primary)[1]
      const outline = { color: c.outline, width: 2 }
      return {
        color: CHART_SERIES.map((name) => (dark ? presetDarkPalettes[name][6] : presetPalettes[name][5])),
        bar: {
          barWidth: 16,
          showBackground: true,
          backgroundStyle: {
            color: rail,
            borderColor: c.outline,
            borderWidth: 2,
            borderRadius: 8,
            shadowBlur: 0,
            shadowColor: c.shadow,
            shadowOffsetX: 2,
            shadowOffsetY: 2,
          },
          itemStyle: { color: fill, borderColor: c.outline, borderWidth: 2, borderRadius: 8 },
        },
        line: {
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 3 },
          itemStyle: { borderColor: c.outline, borderWidth: 1.5 },
        },
        categoryAxis: { axisLine: { lineStyle: outline }, axisTick: { lineStyle: outline }, axisLabel: { color: c.ink } },
        valueAxis: { axisLabel: { color: c.ink }, splitLine: { lineStyle: { color: [c.line], type: 'dashed' } } },
        legend: { textStyle: { color: c.ink } },
        axisPointer: { lineStyle: { color: c.outline, type: 'dashed' } },
        tooltip: {
          backgroundColor: c.card,
          borderColor: c.outline,
          borderWidth: 2,
          borderRadius: 8,
          shadowBlur: 0,
          shadowColor: c.shadow,
          shadowOffsetX: 3,
          shadowOffsetY: 3,
          textStyle: { color: c.ink },
          axisPointer: { lineStyle: { color: c.outline, type: 'dashed' } },
        },
      }
    },
  },
}
