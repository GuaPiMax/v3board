#!/usr/bin/env node
// 像素比对：读取 capture 的新旧截图，输出差异图、差异率和 HTML 报告。
// 用法：node tools/visual-diff/diff.mjs [--viewport desktop|mobile] [--dark] [--hotspots] [--only a,b,prefix*] [--threshold 0.1]
//        [--new new|prod] [--old old|<目录>] [--ui illustration|geek] [--exact]
//   --threshold：pixelmatch 的颜色容差（默认 0.1）。0.1 会忽略 #eee 与 #fff 这类浅色差，复查细微颜色差异时用 0.01
//   --hotspots：按 40px 网格列出每页差异最集中的区域（左上角坐标: 像素数），方便定位
//   --new prod：与打包产物的截图（capture --target prod）比对，差异图与报告带 -prod 后缀
//   --old：基准截图所在的目录（out/ 下，默认 old 即原版）。修改前后对照新版时，先把修改前的截图复制到例如 out/base-prod/，
//          修改后重新截图，再 --old base-prod --new prod
//   --ui illustration|geek：比对该预设的截图（capture --ui ...，目录带 -<预设> 后缀）
//   --exact：逐像素完全一致才算相同（颜色容差 0，抗锯齿像素也计入），用于确认修改前后没有任何变化
// 输出：tools/visual-diff/out/diff/<viewport>/<name>.png 与 tools/visual-diff/out/report-<viewport>.html
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { checkUi, ensureDir, outRoot } from './lib.mjs'

const { values: args } = parseArgs({
  options: {
    viewport: { type: 'string', default: 'desktop' },
    dark: { type: 'boolean', default: false },
    theme: { type: 'string' },
    hotspots: { type: 'boolean', default: false },
    only: { type: 'string' },
    threshold: { type: 'string', default: '0.1' },
    new: { type: 'string', default: 'new' },
    old: { type: 'string', default: 'old' },
    ui: { type: 'string' },
    exact: { type: 'boolean', default: false },
  },
})
const only = args.only?.split(',')
const selected = (name) => !only || only.some((o) => (o.endsWith('*') ? name.startsWith(o.slice(0, -1)) : name === o))
checkUi(args.ui)
const variant = `${args.viewport}${args.dark ? '-dark' : ''}${args.theme ? `-${args.theme.replaceAll(',', '-')}` : ''}${args.ui && args.ui !== 'legacy' ? `-${args.ui}` : ''}`
const oldDir = path.join(outRoot, args.old, variant)
const newDir = path.join(outRoot, args.new, variant)
const suffix = `${args.old === 'old' ? '' : `-${args.old}`}${args.new === 'new' ? '' : `-${args.new}`}`
const diffDir = ensureDir(path.join(outRoot, `diff${suffix}`, variant))

function hotspots(diff, cell = 40, top = 5) {
  const counts = new Map()
  for (let y = 0; y < diff.height; y++) {
    for (let x = 0; x < diff.width; x++) {
      const i = (y * diff.width + x) * 4
      // pixelmatch 用纯红色标记差异像素
      if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
        const key = `${Math.floor(x / cell) * cell},${Math.floor(y / cell) * cell}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .toSorted((p, q) => q[1] - p[1])
    .slice(0, top)
    .map(([k, n]) => `${k}: ${n}`)
    .join('  ')
}

function crop(png, width, height) {
  const out = new PNG({ width, height })
  PNG.bitblt(png, out, 0, 0, width, height, 0, 0)
  return out
}

const rows = []
for (const file of fs.readdirSync(oldDir).filter((f) => f.endsWith('.png') && selected(f.replace(/\.png$/, '')))) {
  const newFile = path.join(newDir, file)
  if (!fs.existsSync(newFile)) continue
  let a = PNG.sync.read(fs.readFileSync(path.join(oldDir, file)))
  let b = PNG.sync.read(fs.readFileSync(newFile))
  const sizeNote = a.width !== b.width || a.height !== b.height ? `尺寸不同：旧 ${a.width}×${a.height} / 新 ${b.width}×${b.height}` : ''
  const width = Math.min(a.width, b.width)
  const height = Math.min(a.height, b.height)
  if (sizeNote) {
    a = crop(a, width, height)
    b = crop(b, width, height)
  }
  const diff = new PNG({ width, height })
  const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: args.exact ? 0 : Number(args.threshold),
    includeAA: args.exact,
  })
  fs.writeFileSync(path.join(diffDir, file), PNG.sync.write(diff))
  const ratio = (mismatched / (width * height)) * 100
  rows.push({
    name: file.replace(/\.png$/, ''),
    ratio,
    mismatched,
    sizeNote,
    spots: args.hotspots && mismatched ? hotspots(diff) : '',
  })
}

rows.sort((x, y) => y.ratio - x.ratio)
for (const r of rows) {
  console.log(`${r.ratio.toFixed(3).padStart(8)}%  ${r.name}${r.sizeNote ? `  （${r.sizeNote}）` : ''}`)
  if (r.spots) console.log(`           ${r.spots}`)
}

const rel = (p) => path.relative(outRoot, p)
const html = `<!doctype html><meta charset="utf-8"><title>视觉比对 ${variant}</title>
<style>body{font:14px -apple-system,sans-serif;margin:20px}table{border-collapse:collapse}td{vertical-align:top;padding:6px;border-bottom:1px solid #ddd}img{width:420px;border:1px solid #ccc}h2{margin:0 0 4px}</style>
<h1>像素比对（${variant}：${args.old} → ${args.new}）</h1><table><tr><th>页面</th><th>${args.old === 'old' ? '旧版' : args.old}</th><th>${args.new === 'new' ? '新版' : args.new}</th><th>差异</th></tr>
${rows
  .map(
    (r) => `<tr><td><h2>${r.name}</h2>${r.ratio.toFixed(3)}%<br>${r.sizeNote}</td>
<td><a href="${rel(path.join(oldDir, r.name + '.png'))}"><img src="${rel(path.join(oldDir, r.name + '.png'))}"></a></td>
<td><a href="${rel(path.join(newDir, r.name + '.png'))}"><img src="${rel(path.join(newDir, r.name + '.png'))}"></a></td>
<td><a href="${rel(path.join(diffDir, r.name + '.png'))}"><img src="${rel(path.join(diffDir, r.name + '.png'))}"></a></td></tr>`,
  )
  .join('\n')}</table>`
fs.writeFileSync(path.join(outRoot, `report-${variant}${suffix}.html`), html)
console.log(`报告：${path.join(outRoot, `report-${variant}${suffix}.html`)}`)
