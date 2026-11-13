// ECharts 按需引入：与原版一致只注册 SVG 渲染器（原版所有图表实际都是 SVG），并使用 v5 主题。
// ECharts 6 的 grid.containLabel 需要注册 LegacyGridContainLabel 才会按 v5 的算法布局。
// 皮肤换成各自的图表主题（见 skinChartTheme.ts：v5 + 暗色的底色 + 皮肤的图表样式，按明暗与主题色各注册一套）；
// 切换暗色、界面预设（顶栏的主题按钮）或主题色时换主题，不重建图表（运行中切到经典的暗色时例外，见下）
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LegacyGridContainLabel, UniversalTransition } from 'echarts/features'
import { SVGRenderer } from 'echarts/renderers'
import { useEffect, useRef, type CSSProperties } from 'react'
import { THEME_PRIMARY } from '@/app/antdTheme'
import type { ThemeColor } from '@/app/settings'
import { isSkin, SKINS } from '@/app/skins'
import type { UiPreset } from '@/app/uiPreset'
import { useAppearanceStore, useUi } from '@/stores/appearance'
import { useThemeStore } from '@/stores/theme'
import { useSkinDark } from '@/utils/darkMode'
import { buildSkinChartTheme } from './skinChartTheme'
import { registerV5Theme } from './v5Theme.js'

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  BarChart,
  UniversalTransition,
  LegacyGridContainLabel,
  SVGRenderer,
])
registerV5Theme(echarts)

export type EChartOption = Parameters<echarts.ECharts['setOption']>[0]

interface EChartProps {
  /** 为空时不渲染数据（与原版一致：接口返回后才 setOption） */
  option?: EChartOption
  id?: string
  className?: string
  style?: CSSProperties
}

const registered = new Set<string>()
/**
 * 图表主题名：legacy 为 v5；皮肤按明暗与主题色各一套（插画的主色跟随主题色），第一次用到时注册。
 * dark 为皮肤的暗色版（legacy 始终为 false）
 */
function chartTheme(ui: UiPreset, dark: boolean, color: ThemeColor) {
  if (!isSkin(ui)) return 'v5'
  const name = `${ui}-${dark ? 'dark' : 'light'}-${color}`
  if (!registered.has(name)) {
    echarts.registerTheme(name, buildSkinChartTheme(SKINS[ui].chart, THEME_PRIMARY[color], dark))
    registered.add(name)
  }
  return name
}

export function EChart({ option, id, className, style }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const ui = useUi()
  const color = useThemeStore((s) => s.theme.color)
  const theme = chartTheme(ui, useSkinDark(), color)
  // 经典开着暗黑模式：图表的颜色由 darkreader 转换
  const reader = useAppearanceStore((s) => s.ui === 'legacy' && s.dark)
  // 图表当前的主题、上一次渲染时的界面预设、最近一次的数据（重建时重新设置）
  const themeRef = useRef('')
  const uiRef = useRef(ui)
  const optionRef = useRef(option)

  useEffect(() => {
    if (!ref.current) return
    themeRef.current = theme
    chartRef.current = echarts.init(ref.current, theme, { renderer: 'svg' })
    const onResize = () => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
    // 只在挂载时创建（主题切换见下）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 切换暗色或界面预设时换主题（与创建时的主题相同时不调用）。
  // 运行中切到经典的暗色时改为在下一帧（darkreader 已经启用）重新画：darkreader 按 SVG 图形的大小决定按背景还是文字换算颜色，
  // 直接打开时图形从 0 长出来，按文字换算；图表画好之后再换主题，柱状图按背景换算、颜色比直接打开时暗。重新画之后与直接打开相同。
  // 在经典里切换暗黑模式不重建（图表不变，与原版一样由 darkreader 转换已经画好的图表）
  useEffect(() => {
    const switched = uiRef.current !== ui
    uiRef.current = ui
    const chart = chartRef.current
    if (!chart) return
    if (switched && reader) {
      themeRef.current = theme
      requestAnimationFrame(() => {
        if (!ref.current || chartRef.current !== chart) return
        chart.dispose()
        chartRef.current = echarts.init(ref.current, theme, { renderer: 'svg' })
        if (optionRef.current) chartRef.current.setOption(optionRef.current)
      })
      return
    }
    if (themeRef.current === theme) return
    themeRef.current = theme
    // 还没有数据时 ECharts 的 setTheme 不生效（没有设置过 option 时直接返回，之后仍按创建时的主题画）：
    // 登录后从后端读到的主题色常常比图表数据先到，这时按新主题重新创建
    if (!optionRef.current) {
      chart.dispose()
      if (ref.current) chartRef.current = echarts.init(ref.current, theme, { renderer: 'svg' })
      return
    }
    chart.setTheme(theme)
  }, [theme, ui, reader])

  useEffect(() => {
    optionRef.current = option
    if (option) chartRef.current?.setOption(option)
  }, [option])

  return <div ref={ref} id={id} className={className} style={style} />
}
