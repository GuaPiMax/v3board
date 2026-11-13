#!/usr/bin/env node
// 运行中切换界面风格的核对：从风格 A 打开页面，点顶栏的主题按钮切到风格 B（不刷新页面），截图后与 B 直接打开时的基准
// 逐像素对照（颜色容差 0，抗锯齿像素也计入）。同时检查：<html> 的 data-v2b-ui / data-v2b-dark、darkreader 只在经典的暗色下启用、
// 保存下来的选择刷新后仍然生效、控制台没有报错。
//   - 默认先切换、再执行状态的操作（打开弹窗、抽屉等）；--before 里列出的状态先执行操作再切换（检查标签页、页码等保持不变）
//   - 截图前隐藏主题按钮（基准里没有它），鼠标移到顶栏标题上，取消焦点；先操作再切换的，切换后把鼠标移回操作结束时
//     鼠标下的那个元素（基准里鼠标停在最后操作的元素上，例如点过的页码显示悬停色；各风格的布局高度不同，按元素的新位置移）
//   - --toggle：切换后再点一次顶栏的暗黑模式按钮（固定暗色的 B 跳过），与 B 另一种明暗的基准对照
// 用法：node tools/visual-diff/switch.mjs [--target prod|new] [--viewport desktop|mobile] [--dark] [--from a,b] [--to a,b]
//        [--only 状态,前缀*] [--before 状态,...] [--toggle] [--base <目录>]
// 基准：legacy 取 out/base-legacy，皮肤取 out/base-<皮肤>（目录按 capture 的规则命名，固定暗色的皮肤不带 -dark）；
// --base 时各预设都取 out/<目录>/（例如改了样式后用 capture --out <目录> 重新拍的直接打开的截图）。
// 例外：--toggle 在经典里切到暗色时，仪表盘对照 out/base-legacy/<viewport>-dark-runtime/dashboard.png（经典里亮色打开后点顶栏
// 按钮切到暗色的截图）：darkreader 按 SVG 图形的大小决定按背景还是文字换算颜色，直接打开时柱子从 0 长出来，按文字换算（较亮），
// 图表画好之后再启用时按背景换算（较暗），原版切换暗黑模式也是这样。运行中切换风格进入经典暗色时图表会重新画，与直接打开相同
//（见 components/echarts/EChart.tsx）
// 输出：out/switch-run/<viewport>[-dark]/<A>-to-<B>/<状态>.png 与差异图 <状态>.diff.png；汇总在最后打印
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { routes } from './routes.mjs'
import { ALWAYS_DARK, assertPreset, ensureDir, gotoRoute, launch, login, openPage, outRoot, targets, UI_PRESETS } from './lib.mjs'

const DEFAULT_STATES = [
  'dashboard',
  'user',
  'user-traffic-modal',
  'user-create-modal',
  'user-delete-confirm',
  'server-manage',
  'server-manage-drawer-edit-v2node',
  'config-system-subscribe',
  'order-detail-modal',
]
const DEFAULT_BEFORE = ['config-system-subscribe', 'user-page-2']

const { values: args } = parseArgs({
  options: {
    target: { type: 'string', default: 'prod' },
    viewport: { type: 'string', default: 'desktop' },
    dark: { type: 'boolean', default: false },
    from: { type: 'string' },
    to: { type: 'string' },
    only: { type: 'string' },
    before: { type: 'string' },
    toggle: { type: 'boolean', default: false },
    base: { type: 'string' },
  },
})

const presets = (list) => (list ? list.split(',') : UI_PRESETS)
for (const ui of [...presets(args.from), ...presets(args.to)]) {
  if (!UI_PRESETS.includes(ui)) throw new Error(`界面预设只能是 ${UI_PRESETS.join(' / ')}，收到 ${ui}`)
}
const only = args.only?.split(',')
const before = new Set(args.before?.split(',') ?? DEFAULT_BEFORE)
const wanted = (name) => (only ? only.some((o) => (o.endsWith('*') ? name.startsWith(o.slice(0, -1)) : name === o)) : true)
const byName = new Map(routes.map((r) => [r.name, r]))
const cases = [...new Set([...DEFAULT_STATES, ...before])]
  .filter(wanted)
  .map((name) => byName.get(name))
  .filter((r) => r && (!r.mobileOnly || args.viewport === 'mobile') && (!r.desktopOnly || args.viewport === 'desktop'))

const variant = (ui, dark) => `${args.viewport}${dark && !ALWAYS_DARK.includes(ui) ? '-dark' : ''}${ui === 'legacy' ? '' : `-${ui}`}`
const RUNTIME_DARK = new Set(['dashboard'])
function baseline(ui, dark, name) {
  if (args.base) return path.join(outRoot, args.base, variant(ui, dark), `${name}.png`)
  if (args.toggle && ui === 'legacy' && dark && RUNTIME_DARK.has(name)) {
    return path.join(outRoot, 'base-legacy', `${args.viewport}-dark-runtime`, `${name}.png`)
  }
  return path.join(outRoot, ui === 'legacy' ? 'base-legacy' : `base-${ui}`, variant(ui, dark), `${name}.png`)
}
const runDir = ensureDir(path.join(outRoot, 'switch-run', `${args.viewport}${args.dark ? '-dark' : ''}${args.toggle ? '-toggle' : ''}`))

const token = await login()
const browser = await launch()
const results = []

/** 鼠标移到顶栏标题上（标题不响应悬停） */
async function moveToTitle(page) {
  const box = await (await page.$('.v2board-container-title'))?.boundingBox()
  if (box) await page.mouse.move(box.x + 2, box.y + box.height / 2)
}

async function switchTo(page, to) {
  await page.click('.v2b-ui-switch > button')
  await page.waitForSelector('.v2b-ui-switch .dropdown-menu.show .v2b-ui-option')
  const index = UI_PRESETS.indexOf(to)
  await page.click(`.v2b-ui-switch .v2b-ui-option:nth-child(${index + 1})`)
  // 菜单收起后鼠标下面可能是页面上的悬停菜单（手机上用户管理的「操作」就在选项下面），点完立刻移开
  await moveToTitle(page)
  await page.waitForFunction((ui) => document.documentElement.dataset.v2bUi === ui, { timeout: 10000 }, to)
  // antd 换主题、darkreader 启用与图表换主题都在这之后完成
  await new Promise((r) => setTimeout(r, 1500))
  await page.addStyleTag({ content: '.v2b-ui-switch{display:none!important}' })
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await moveToTitle(page)
  await new Promise((r) => setTimeout(r, 300))
}

function compare(shot, base) {
  if (!fs.existsSync(base)) return { note: '没有基准' }
  let a = PNG.sync.read(fs.readFileSync(base))
  let b = PNG.sync.read(fs.readFileSync(shot))
  if (a.width !== b.width || a.height !== b.height) return { note: `尺寸不同：基准 ${a.width}×${a.height} / 切换后 ${b.width}×${b.height}`, mismatched: -1 }
  const diff = new PNG({ width: a.width, height: a.height })
  const mismatched = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0, includeAA: true })
  if (mismatched) fs.writeFileSync(shot.replace(/\.png$/, '.diff.png'), PNG.sync.write(diff))
  return { mismatched }
}

for (const from of presets(args.from)) {
  for (const to of presets(args.to)) {
    if (from === to || (args.toggle && ALWAYS_DARK.includes(to))) continue
    // 切换之后的明暗（--toggle 时再切一次）
    const dark = args.toggle ? !args.dark : args.dark
    const dir = ensureDir(path.join(runDir, `${from}-to-${to}`))
    for (const [i, r] of cases.entries()) {
      const mode = before.has(r.name) ? 'before' : 'after'
      const page = await openPage(browser, { token, viewport: args.viewport, dark: args.dark, ui: from, uiSwitch: true })
      const errors = []
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`)
      })
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      const shot = path.join(dir, `${r.name}${mode === 'before' ? '.before' : ''}.png`)
      const row = { from, to, name: r.name, mode }
      try {
        await gotoRoute(page, targets[args.target](), r.route, { settle: r.settle })
        await assertPreset(page, { ui: from, dark: args.dark })
        let hovered = false
        if (mode === 'before' && r.state) {
          await page.evaluate(() =>
            document.addEventListener('mousemove', (e) => (window.v2bToolHover = document.elementFromPoint(e.clientX, e.clientY)), true),
          )
          await r.state(page)
          // 切换时鼠标还会移到主题按钮上，这里先记下操作结束时鼠标下的元素
          hovered = await page.evaluate(() => Boolean((window.v2bToolTarget = window.v2bToolHover)))
        }
        await switchTo(page, to)
        if (hovered) {
          // 同一个元素（React 复用了节点）按新位置移过去；节点被替换时按原来的文字找同类元素
          const point = await page.evaluate(() => {
            let el = window.v2bToolTarget
            if (!el.isConnected) {
              const text = el.textContent.trim()
              el = [...document.querySelectorAll(el.tagName)].find((node) => node.textContent.trim() === text)
            }
            if (!el) return null
            const rect = el.getBoundingClientRect()
            return [rect.x + rect.width / 2, rect.y + rect.height / 2]
          })
          if (point) {
            await page.mouse.move(point[0], point[1])
            await new Promise((resolve) => setTimeout(resolve, 300))
          }
        }
        if (args.toggle) {
          await page.evaluate(() => document.querySelector('#page-header .fa-sun, #page-header .fa-moon')?.closest('button')?.click())
          await page.waitForFunction((want) => document.cookie.includes(`dark_mode=${want}`), { timeout: 10000 }, dark ? 1 : 0)
          await new Promise((resolve) => setTimeout(resolve, 1500))
          await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
        }
        if (mode === 'after' && r.state) await r.state(page)
        await assertPreset(page, { ui: to, dark })
        const readers = await page.evaluate(() => document.querySelectorAll('style.darkreader').length)
        const expectReader = to === 'legacy' && dark
        if (Boolean(readers) !== expectReader) throw new Error(`darkreader 的样式 ${readers} 个，应该${expectReader ? '有' : '没有'}`)
        const fullPage = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
        await page.screenshot({ path: shot, fullPage })
        Object.assign(row, compare(shot, baseline(to, dark, r.name)))
        // 每个方向最后一个状态再检查：选择存在浏览器里，刷新后仍是 B
        if (i === cases.length - 1) {
          await page.reload({ waitUntil: 'networkidle0' })
          const ui = await page.evaluate(() => [document.documentElement.dataset.v2bUi, localStorage.getItem('v2b_ui')])
          row.reload = ui[0] === to && ui[1] === to ? '刷新后保持' : `刷新后是 ${ui.join(' / ')}`
        }
      } catch (e) {
        row.error = e.message
      } finally {
        row.errors = errors
        results.push(row)
        const status = row.error
          ? `失败：${row.error}`
          : row.note ?? (row.mismatched ? `不一致 ${row.mismatched} 像素` : '一致')
        console.log(`${from} → ${to}  ${r.name}${mode === 'before' ? '（先操作再切换）' : ''}  ${status}${row.reload ? `  ${row.reload}` : ''}${errors.length ? `\n    ${errors.join('\n    ')}` : ''}`)
        await page.close()
      }
    }
  }
}
await browser.close()

const bad = results.filter((r) => r.error || r.mismatched || r.note || r.errors.length || (r.reload && r.reload !== '刷新后保持'))
console.log(`\n共 ${results.length} 项，一致 ${results.length - bad.length} 项${bad.length ? `，需要看的 ${bad.length} 项：` : ''}`)
for (const r of bad) console.log(`  ${r.from} → ${r.to}  ${r.name}  ${r.error ?? r.note ?? (r.mismatched ? `${r.mismatched} 像素` : '')}${r.errors.length ? '  控制台有报错' : ''}${r.reload && r.reload !== '刷新后保持' ? `  ${r.reload}` : ''}`)
process.exit(bad.length ? 1 : 0)
