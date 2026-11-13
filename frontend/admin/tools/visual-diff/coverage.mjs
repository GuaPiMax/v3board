#!/usr/bin/env node
// 采集旧管理端实际命中的 CSS 规则区间（umi.css / components.chunk.css / theme/*.css），
// 写入 .umi-src/css/ranges-<文件>[.<tag>].json（本地，gitignored，不提交）；
// 再由 tools/css-extract/used-rules.mjs 结合原文件解析出带 @media 上下文的规则清单。
// 用法：node tools/visual-diff/coverage.mjs [--viewport mobile] [--dark] [--sidebar dark] [--header light] [--color green]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { routes } from './routes.mjs'
import { ensureDir, gotoRoute, launch, login, openPage, projectRoot, targets } from './lib.mjs'

const { values: args } = parseArgs({
  options: {
    viewport: { type: 'string', default: 'desktop' },
    dark: { type: 'boolean', default: false },
    sidebar: { type: 'string' },
    header: { type: 'string' },
    color: { type: 'string' },
    tag: { type: 'string', default: '' },
  },
})
const theme =
  args.sidebar || args.header || args.color
    ? { sidebar: args.sidebar ?? 'light', header: args.header ?? 'dark', color: args.color ?? 'default' }
    : undefined

const outDir = ensureDir(path.join(projectRoot, '.umi-src/css'))
const token = await login()
const browser = await launch()
const base = targets.old()
const collected = new Map() // url -> {text, ranges[]}

function merge(entries) {
  for (const e of entries) {
    const name = new URL(e.url).pathname.split('/').pop()
    if (!name.endsWith('.css')) continue
    const prev = collected.get(name) ?? { text: e.text, ranges: [] }
    prev.ranges.push(...e.ranges)
    collected.set(name, prev)
  }
}

for (const r of routes) {
  const page = await openPage(browser, { token: r.auth === false ? null : token, viewport: args.viewport, theme, dark: args.dark })
  await page.coverage.startCSSCoverage({ resetOnNavigation: false })
  await gotoRoute(page, base, r.route, { settle: r.settle })
  if (r.state) await r.state(page)
  merge(await page.coverage.stopCSSCoverage())
  await page.close()
  console.log(`coverage ${r.name}`)
}
await browser.close()

// 合并区间并导出（偏移量基于原文件文本）
for (const [name, { text, ranges }] of collected) {
  if (!text.length) continue
  ranges.sort((a, b) => a.start - b.start)
  const merged = []
  for (const r of ranges) {
    const last = merged.at(-1)
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ start: r.start, end: r.end })
  }
  const suffix = args.tag ? `.${args.tag}` : ''
  fs.writeFileSync(path.join(outDir, `ranges-${name.replace(/\.css$/, '')}${suffix}.json`), JSON.stringify(merged))
  const pct = ((merged.reduce((s, r) => s + r.end - r.start, 0) / text.length) * 100).toFixed(1)
  console.log(`${name}: 命中 ${merged.length} 段，占 ${pct}%`)
}
