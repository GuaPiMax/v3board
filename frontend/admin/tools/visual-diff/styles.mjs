#!/usr/bin/env node
// 计算样式比对：在新旧版同一页面上，对一组选择器的首个匹配元素取 getComputedStyle 与盒模型，输出差异。
// 用法：node tools/visual-diff/styles.mjs --route /notice [--state notice-modal-create] [--viewport mobile] --sel ".block,#sidebar,.nav-main-link"
import { parseArgs } from 'node:util'
import { routes } from './routes.mjs'
import { gotoRoute, launch, login, openPage, targets } from './lib.mjs'

const { values: args } = parseArgs({
  options: {
    route: { type: 'string', default: '/dashboard' },
    state: { type: 'string' },
    sel: { type: 'string', default: 'body,#page-container,#sidebar,#page-header,.content-header,.nav-main-link,.nav-main-heading,.block' },
    props: {
      type: 'string',
      default:
        'font-family,font-size,font-weight,line-height,color,background-color,padding,margin,border,border-radius,box-shadow,height,width,letter-spacing,font-variant-numeric,font-feature-settings',
    },
    auth: { type: 'boolean', default: true },
    viewport: { type: 'string', default: 'desktop' },
  },
})

const selectors = args.sel.split(/,(?![^(]*\))/).map((s) => s.trim())
const props = args.props.split(',')
const token = args.auth ? await login() : null
const browser = await launch()
const state = args.state ? routes.find((r) => r.name === args.state)?.state : undefined

async function collect(target) {
  const page = await openPage(browser, { token, viewport: args.viewport })
  await gotoRoute(page, targets[target](), args.route)
  if (state) await state(page)
  const result = await page.evaluate(
    (sels, ps) =>
      Object.fromEntries(
        sels.map((sel) => {
          const [base, pseudo] = sel.split('::')
          const el = document.querySelector(base)
          if (!el) return [sel, null]
          const cs = getComputedStyle(el, pseudo ? `::${pseudo}` : undefined)
          const rect = el.getBoundingClientRect()
          const out = Object.fromEntries(ps.map((p) => [p, cs.getPropertyValue(p)]))
          out.box = `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(rect.height)}`
          return [sel, out]
        }),
      ),
    selectors,
    props,
  )
  await page.close()
  return result
}

const oldStyles = await collect('old')
const newStyles = await collect('new')
await browser.close()

for (const sel of selectors) {
  const a = oldStyles[sel]
  const b = newStyles[sel]
  if (!a || !b) {
    console.log(`\n${sel}: ${!a ? '旧版未找到' : ''}${!b ? ' 新版未找到' : ''}`)
    continue
  }
  const diffs = Object.keys(a).filter((k) => a[k] !== b[k])
  console.log(`\n${sel}: ${diffs.length ? '' : '一致'}`)
  for (const k of diffs) console.log(`  ${k}\n    旧: ${a[k]}\n    新: ${b[k]}`)
}
