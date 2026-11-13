import { theme } from 'antd'
import { describe, expect, it } from 'vitest'
import { buildAntdTheme, buildComponentConfig, fade, legacyPreview, THEME_PRIMARY } from '../src/app/antdTheme'
import { SKINS, type SkinChart, type SkinName } from '../src/app/skins'
import { NEON } from '../src/app/skins/geek'
import { contrast } from '../src/app/skins/color'
import { parseUiPreset, UI_PRESET_OPTIONS } from '../src/app/uiPreset'
import { buildSkinChartTheme } from '../src/components/echarts/skinChartTheme'
import { buildV5Theme } from '../src/components/echarts/v5Theme.js'

// 原版 theme/*.css 中由 antd 3 色板算法生成的颜色（hover = 色板第 5 级，active = 第 7 级，行悬停 = 第 1 级）
const expected: Record<string, { hover: string; active: string; bg1: string; focus: string }> = {
  default: { hover: '#2a84de', active: '#004aab', bg1: '#e6f6ff', focus: 'rgba(6, 101, 208, 0.2)' },
  black: { hover: '#484a4d', active: '#13161a', bg1: '#787d80', focus: 'rgba(52, 58, 64, 0.2)' },
  darkblue: { hover: '#5b75a6', active: '#273c73', bg1: '#ccd2d9', focus: 'rgba(59, 89, 152, 0.2)' },
  green: { hover: '#4ea39f', active: '#1e6f70', bg1: '#c9d6d4', focus: 'rgba(49, 151, 149, 0.2)' },
}

describe('antd 6 主题色与原版 antd 3 色板一致', () => {
  for (const color of Object.keys(THEME_PRIMARY) as Array<keyof typeof THEME_PRIMARY>) {
    it(color, () => {
      const config = buildAntdTheme(color, 'legacy')
      const token = theme.getDesignToken(config)
      expect(token.colorPrimary).toBe(THEME_PRIMARY[color])
      expect(token.colorPrimaryHover).toBe(expected[color].hover)
      expect(token.colorPrimaryActive).toBe(expected[color].active)
      expect(config.components?.Table?.rowHoverBg).toBe(expected[color].bg1)
      // 聚焦：边框 = hover 色，光晕 = 主题色 20%（原版 .ant-input:focus / .ant-select-focused）
      expect(config.components?.Input?.activeBorderColor).toBe(expected[color].hover)
      expect(config.components?.Select?.activeBorderColor).toBe(expected[color].hover)
      expect(config.components?.Input?.activeShadow).toBe(`0 0 0 2px ${expected[color].focus}`)
    })
  }
})

describe('fade', () => {
  it('与 antd 3 的 fade() 一致', () => {
    expect(fade('#0665d0', 0.2)).toBe('rgba(6, 101, 208, 0.2)')
  })
})

describe('界面预设', () => {
  it('默认是 legacy', () => {
    expect(buildAntdTheme('default')).toEqual(buildAntdTheme('default', 'legacy'))
  })

  it('组件默认属性：标签带边框、分页不显示每页条数各预设都有，legacy 另外还原抽屉与下拉列表的 antd 3 行为', () => {
    const shared = { tag: { variant: 'outlined' }, pagination: { showSizeChanger: false } }
    expect(buildComponentConfig('legacy')).toEqual({
      ...shared,
      drawer: { closable: { placement: 'end' }, focusable: { focusTriggerAfterClose: false } },
      virtual: false,
    })
  })
})

describe('皮肤', () => {
  const skinNames = Object.keys(SKINS) as SkinName[]
  const colors = Object.keys(THEME_PRIMARY) as Array<keyof typeof THEME_PRIMARY>

  it('存下的界面预设：认识的原样使用，其余（包括已经去掉的 modern）按 legacy', () => {
    expect(parseUiPreset('legacy')).toBe('legacy')
    for (const name of skinNames) expect(parseUiPreset(name)).toBe(name)
    expect(parseUiPreset('modern')).toBe('legacy')
    expect(parseUiPreset('glass')).toBe('legacy')
    expect(parseUiPreset('toString')).toBe('legacy')
    expect(parseUiPreset(undefined)).toBe('legacy')
  })

  it('每种皮肤都能生成亮色 / 暗色主题，且保留各预设共用的设置（不加 hash class、CSS 变量的 key）', () => {
    for (const name of skinNames) {
      for (const dark of [false, true]) {
        const config = buildAntdTheme('default', name, dark)
        expect(config.hashed).toBe(false)
        expect(config.cssVar).toEqual({ key: 'v2b' })
        expect(theme.getDesignToken(config).colorBgContainer).toBeTruthy()
      }
    }
  })

  it('插画：主色跟随四套主题色，暗色版换成暗色算法', () => {
    for (const color of colors) {
      expect(theme.getDesignToken(buildAntdTheme(color, 'illustration')).colorPrimary).toBe(THEME_PRIMARY[color])
    }
    expect(buildAntdTheme('default', 'illustration').algorithm).toBe(theme.defaultAlgorithm)
    expect(buildAntdTheme('default', 'illustration', true).algorithm).toBe(theme.darkAlgorithm)
  })

  it('插画暗色版：四套主题色的链接在内容块上对比度不低于 4.5，主色（按钮底色）与底色、按钮白字都分得开', () => {
    for (const color of colors) {
      const token = theme.getDesignToken(buildAntdTheme(color, 'illustration', true))
      expect(contrast(token.colorLink, token.colorBgContainer)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token.colorLinkHover, token.colorBgContainer)).toBeGreaterThan(
        contrast(token.colorLink, token.colorBgContainer),
      )
      expect(contrast(token.colorPrimary, token.colorBgContainer)).toBeGreaterThanOrEqual(2.8)
      expect(contrast('#ffffff', token.colorPrimary)).toBeGreaterThanOrEqual(4.4)
    }
  })

  it('插画：默认按钮悬停、按下时描边保持深色，与按钮组的外框、中缝一致', () => {
    for (const dark of [false, true]) {
      const { token, components } = buildAntdTheme('default', 'illustration', dark)
      expect(components?.Button).toMatchObject({
        defaultHoverBorderColor: token?.colorBorder,
        defaultActiveBorderColor: token?.colorBorder,
        groupBorderColor: token?.colorBorder,
      })
    }
  })

  it('极客：主色固定为霓虹绿（不随主题色，也不被暗色算法压暗），固定暗色', () => {
    expect(SKINS.geek.dark).toBe('always')
    for (const color of colors) {
      for (const dark of [false, true]) {
        const config = buildAntdTheme(color, 'geek', dark)
        expect(config.algorithm).toContain(theme.darkAlgorithm)
        const token = theme.getDesignToken(config)
        expect(token.colorPrimary).toBe('#39ff14')
        expect(token.colorLink).toBe('#39ff14')
      }
    }
  })

  it('极客：正文、链接、占位文字在内容块上看得清，主按钮上的文字用深色', () => {
    const config = buildAntdTheme('default', 'geek')
    const design = theme.getDesignToken(config)
    expect(contrast(design.colorText, design.colorBgContainer)).toBeGreaterThanOrEqual(7)
    expect(contrast(design.colorLink, design.colorBgContainer)).toBeGreaterThanOrEqual(7)
    expect(contrast(design.colorTextPlaceholder, design.colorBgContainer)).toBeGreaterThanOrEqual(4)
    expect(contrast(String(config.components?.Button?.primaryColor), design.colorPrimary)).toBeGreaterThanOrEqual(7)
  })

  it('legacy 不受暗色参数影响（它的暗黑模式由 darkreader 处理）', () => {
    expect(buildAntdTheme('green', 'legacy', true)).toEqual(buildAntdTheme('green', 'legacy'))
  })

  it('皮肤的组件默认属性包含共用的标签边框与分页设置', () => {
    const shared = { tag: { variant: 'outlined' }, pagination: { showSizeChanger: false } }
    for (const name of skinNames) {
      expect(buildComponentConfig(name)).toEqual({ ...shared, ...SKINS[name].components })
    }
  })
})

/** '2px solid #2C2C2C' → '#2C2C2C' */
const lineColor = (border: string) => border.split(' ').at(-1)

describe('顶栏主题按钮的选项', () => {
  const colors = Object.keys(THEME_PRIMARY) as Array<keyof typeof THEME_PRIMARY>

  it('经典在前，皮肤按注册表的顺序，名称不重复', () => {
    expect(UI_PRESET_OPTIONS.map((option) => option.value)).toEqual(['legacy', ...Object.keys(SKINS)])
    expect(UI_PRESET_OPTIONS.map((option) => option.label)).toEqual(['经典', '插画', '极客'])
  })

  it('四套主题色、亮暗下都看得清：名称与卡片底色的对比度不低于 4.5，当前项的勾不低于 3', () => {
    for (const option of UI_PRESET_OPTIONS) {
      for (const color of colors) {
        for (const dark of [false, true]) {
          const preview = option.preview(THEME_PRIMARY[color], dark)
          expect(contrast(preview.color, preview.background)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(preview.check, preview.background)).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  it('插画：底色、描边、色块与切过去之后的主题一致，明暗跟随暗黑模式', () => {
    for (const color of colors) {
      for (const dark of [false, true]) {
        const preview = SKINS.illustration.preview(THEME_PRIMARY[color], dark)
        const token = buildAntdTheme(color, 'illustration', dark).token!
        expect(preview.background).toBe(token.colorBgBase)
        expect(preview.color).toBe(token.colorText)
        expect(lineColor(preview.border)).toBe(token.colorBorder)
        expect(preview.accent).toBe(token.colorPrimary)
      }
    }
  })

  it('极客：底色与主题一致，描边、色块为霓虹绿，不看暗黑模式（固定暗色）', () => {
    const token = buildAntdTheme('default', 'geek').token!
    const preview = SKINS.geek.preview(THEME_PRIMARY.green, false)
    expect(preview).toEqual(SKINS.geek.preview(THEME_PRIMARY.default, true))
    expect(preview.background).toBe(token.colorBgBase)
    expect(lineColor(preview.border)).toBe(token.colorPrimary)
    expect(preview.accent).toBe(token.colorPrimary)
  })

  it('经典：亮色为 antd 3 的描边与主题色，暗色为 darkreader 转换后的颜色', () => {
    const token = buildAntdTheme('default', 'legacy').token!
    for (const color of colors) {
      const light = legacyPreview(THEME_PRIMARY[color], false)
      expect(lineColor(light.border)).toBe(token.colorBorder)
      expect(light.accent).toBe(THEME_PRIMARY[color])
      expect(light.check).toBe(THEME_PRIMARY[color])
      const dark = legacyPreview(THEME_PRIMARY[color], true)
      expect(dark.background).toBe('#242525')
      expect(dark.accent).not.toBe(light.accent)
    }
  })
})

/** 皮肤的图表主题对象（v5 + 暗色的底色 + 皮肤的图表样式，与 EChart 注册的相同） */
const chartTheme = (chart: SkinChart | undefined, color: keyof typeof THEME_PRIMARY, dark: boolean) =>
  buildSkinChartTheme(chart, THEME_PRIMARY[color], dark) as Record<string, any>

describe('皮肤的图表主题', () => {
  const colors = Object.keys(THEME_PRIMARY) as Array<keyof typeof THEME_PRIMARY>

  it('亮色、没有皮肤样式时就是 v5（与 legacy 相同）', () => {
    expect(chartTheme(undefined, 'default', false)).toEqual(buildV5Theme())
  })

  it('暗色的底色：没有设置时提示框为暖灰、文字为半透明白色；极客用自己的颜色，系列配色从霓虹绿开始', () => {
    const base = chartTheme({}, 'default', true)
    expect(base.color).toEqual(buildV5Theme().color)
    expect(base.tooltip.backgroundColor).toBe('rgba(40, 38, 35, 0.96)')
    expect(base.valueAxis.axisLabel.color).toBe('rgba(255, 255, 255, 0.72)')
    const dark = SKINS.geek.chart?.dark
    const geek = chartTheme({ dark }, 'default', true)
    expect(geek.color[0]).toBe(NEON)
    expect(geek.valueAxis.axisLine.lineStyle.color).toBe(dark?.axis)
    expect(geek.tooltip.backgroundColor).toBe(dark?.tooltipBg)
  })

  it('插画：排行的柱子是进度条（有底槽），填充为主色，描边、错位阴影、提示框与皮肤同色，跟随主题色与明暗', () => {
    for (const color of colors) {
      for (const dark of [false, true]) {
        const chart = chartTheme(SKINS.illustration.chart, color, dark)
        // 顶栏主题按钮的预览卡片与 antd 主题用同一组调色板（见上面的单测）
        const preview = SKINS.illustration.preview(THEME_PRIMARY[color], dark)
        const outline = lineColor(preview.border)
        const shadow = preview.boxShadow?.split(' ').at(-1)
        expect(chart.bar.showBackground).toBe(true)
        expect(chart.bar.itemStyle.color).toBe(preview.accent)
        expect(chart.bar.itemStyle.borderColor).toBe(outline)
        expect(chart.bar.backgroundStyle.color).not.toBe(chart.bar.itemStyle.color)
        expect(chart.bar.backgroundStyle.borderColor).toBe(outline)
        expect(chart.bar.backgroundStyle).toMatchObject({ shadowBlur: 0, shadowColor: shadow })
        expect(chart.tooltip).toMatchObject({ borderColor: outline, shadowBlur: 0, shadowColor: shadow })
        expect(chart.tooltip.textStyle.color).toBe(preview.color)
        expect(chart.valueAxis.axisLabel.color).toBe(preview.color)
      }
    }
  })

  it('极客：底槽为半透明霓虹绿，填充霓虹绿、直角、带发光；坐标轴文字单独写等宽字体（containLabel 按它量宽度）', () => {
    const chart = chartTheme(SKINS.geek.chart, 'default', true)
    expect(chart.bar.backgroundStyle.color).toBe('rgba(57, 255, 20, 0.18)')
    expect(chart.bar.itemStyle).toMatchObject({ color: NEON, borderRadius: 0 })
    expect(chart.bar.itemStyle.shadowBlur).toBeGreaterThan(0)
    expect(chart.categoryAxis.axisLabel.fontFamily).toBe(chart.textStyle.fontFamily)
    expect(chart.valueAxis.axisLabel.fontFamily).toBe(chart.textStyle.fontFamily)
    expect(chart.tooltip.defaultBorderColor).toBe(NEON)
    // 暗色的底色仍在下面
    expect(chart.valueAxis.axisLine.lineStyle.color).toBe(SKINS.geek.chart?.dark?.axis)
  })
})
