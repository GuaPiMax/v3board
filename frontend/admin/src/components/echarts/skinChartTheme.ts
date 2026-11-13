// 皮肤的图表主题：以 v5 主题（与原版一致的布局、配色）为底；暗色时先把文字、坐标轴、分隔线、提示框换成暗底上的颜色，
// 背景透明（透出内容块的底色）；最后叠上皮肤自己的图表样式（app/skins 的 Skin.chart.theme：柱状图、折线图、坐标轴、提示框等）。
// legacy 不用这里：亮色与暗黑模式都是 v5（暗黑模式由 darkreader 转换）
import type { SkinChart, SkinChartColors } from '@/app/skins'
import { buildV5Theme } from './v5Theme.js'

const DEFAULTS: Required<Omit<SkinChartColors, 'palette'>> = {
  text: 'rgba(255, 255, 255, 0.72)',
  textStrong: 'rgba(255, 255, 255, 0.85)',
  axis: 'rgba(255, 255, 255, 0.4)',
  split: 'rgba(255, 255, 255, 0.12)',
  inactive: 'rgba(255, 255, 255, 0.3)',
  tooltipBg: 'rgba(40, 38, 35, 0.96)',
  tooltipBorder: 'rgba(255, 255, 255, 0.2)',
}

function buildDark({ palette, ...colors }: SkinChartColors = {}) {
  const c = { ...DEFAULTS, ...colors }
  const axis = {
    axisLine: { lineStyle: { color: c.axis } },
    axisLabel: { color: c.text },
    splitLine: { lineStyle: { color: [c.split] } },
    splitArea: { areaStyle: { color: ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)'] } },
    minorSplitLine: { color: 'rgba(255, 255, 255, 0.06)' },
  }
  return {
    ...(palette && { color: palette }),
    backgroundColor: 'transparent',
    textStyle: { color: c.text },
    timeAxis: axis,
    logAxis: axis,
    valueAxis: axis,
    categoryAxis: axis,
    axisPointer: { lineStyle: { color: c.axis }, shadowStyle: { color: 'rgba(255, 255, 255, 0.08)' } },
    legend: {
      inactiveColor: c.inactive,
      inactiveBorderColor: c.inactive,
      lineStyle: { inactiveColor: c.inactive },
      textStyle: { color: c.text },
      pageIconColor: c.text,
      pageIconInactiveColor: c.inactive,
      pageTextStyle: { color: c.text },
    },
    title: { textStyle: { color: c.textStrong }, subtextStyle: { color: c.text } },
    tooltip: {
      axisPointer: { crossStyle: { color: c.axis } },
      textStyle: { color: c.textStrong },
      backgroundColor: c.tooltipBg,
      defaultBorderColor: c.tooltipBorder,
    },
  }
}

type Plain = Record<string, unknown>
const isPlain = (value: unknown): value is Plain => typeof value === 'object' && value !== null && !Array.isArray(value)

/** 深合并（数组整体替换） */
function merge(base: Plain, patch: Plain): Plain {
  const result: Plain = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key]
    result[key] = isPlain(current) && isPlain(value) ? merge(current, value) : value
  }
  return result
}

/** chart：皮肤的图表定义；primary：当前主题色；dark：是否暗色 */
export function buildSkinChartTheme(chart: SkinChart | undefined, primary: string, dark: boolean): Plain {
  let theme = buildV5Theme()
  if (dark) theme = merge(theme, buildDark(chart?.dark))
  if (chart?.theme) theme = merge(theme, chart.theme(primary, dark))
  return theme
}
