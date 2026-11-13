#!/usr/bin/env node
// 漏掉的样式类：在新版各页面 / 状态里收集 DOM 用到的 class，列出「新版样式里没有任何规则、原版样式（umi.css 与主题 css）
// 里有规则」的那些。颜色很浅的漏还原（例如浅色背景）在默认容差的像素比对里不明显，用它补查。
// 用法：node tools/visual-diff/classes.mjs [--viewport desktop|mobile] [--only a,b,prefix*]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { routes } from './routes.mjs'
import { gotoRoute, launch, login, openPage, projectRoot, targets } from './lib.mjs'

const { values: args } = parseArgs({
  options: {
    viewport: { type: 'string', default: 'desktop' },
    only: { type: 'string' },
  },
})

const CLASS_IN_SELECTOR = /\.(-?[_a-zA-Z][\w-]*)/g

/** 选择器里出现的 class（每条规则取 { 之前的部分，@media 等嵌套规则同样适用） */
function selectorClasses(cssText) {
  const classes = new Set()
  for (const [, prelude] of cssText.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const [, name] of prelude.matchAll(CLASS_IN_SELECTOR)) classes.add(name)
  }
  return classes
}

const legacyDir = path.resolve(projectRoot, '../v2b-demo/src/public/assets/admin')
const legacyCss = [path.join(legacyDir, 'umi.css'), ...fs.readdirSync(path.join(legacyDir, 'theme')).map((f) => path.join(legacyDir, 'theme', f))]
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
const legacyClasses = selectorClasses(legacyCss)

const only = args.only?.split(',')
const list = routes
  .filter((r) => (only ? only.some((o) => (o.endsWith('*') ? r.name.startsWith(o.slice(0, -1)) : r.name === o)) : !r.coverageOnly))
  .filter((r) => !r.mobileOnly || args.viewport === 'mobile')
  .filter((r) => !r.desktopOnly || args.viewport === 'desktop')

const token = await login()
const browser = await launch()
/** class → 第一次出现的状态 */
const missing = new Map()
for (const r of list) {
  const page = await openPage(browser, { token: r.auth === false ? null : token, viewport: args.viewport })
  try {
    await gotoRoute(page, targets.new(), r.route, { settle: r.settle })
    if (r.state) await r.state(page)
    const { used, css } = await page.evaluate(() => {
      const names = new Set()
      for (const el of document.querySelectorAll('[class]')) for (const name of el.classList) names.add(name)
      const texts = []
      const walk = (rules) => {
        for (const rule of rules) {
          if (rule.selectorText) texts.push(`${rule.selectorText}{}`)
          if (rule.cssRules) walk(rule.cssRules)
        }
      }
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules)
        } catch {
          // 跨域样式表（如 Google Fonts）读不到规则，不影响结果
        }
      }
      return { used: [...names], css: texts.join('\n') }
    })
    const own = selectorClasses(css)
    for (const name of used) {
      if (!own.has(name) && legacyClasses.has(name) && !missing.has(name)) missing.set(name, r.name)
    }
    console.error(`new ${r.name}`)
  } catch (e) {
    console.error(`new ${r.name} 失败：${e.message}`)
  } finally {
    await page.close()
  }
}
await browser.close()

if (missing.size === 0) console.log('没有漏掉的样式类')
for (const [name, state] of missing) console.log(`${name}\t（首次出现：${state}）`)
