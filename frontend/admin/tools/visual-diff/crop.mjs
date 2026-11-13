#!/usr/bin/env node
// 放大查看差异：把新旧截图与差异图的同一区域裁剪、放大后上下拼接，输出到 tools/visual-diff/out/crop.png。
// 用法：node tools/visual-diff/crop.mjs --name notice --rect 300,60,240,80 [--scale 4] [--viewport mobile] [--dark] [--ui illustration|geek]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { PNG } from 'pngjs'
import { checkUi, outRoot } from './lib.mjs'

const { values: args } = parseArgs({
  options: {
    name: { type: 'string' },
    rect: { type: 'string' },
    scale: { type: 'string', default: '4' },
    viewport: { type: 'string', default: 'desktop' },
    dark: { type: 'boolean', default: false },
    theme: { type: 'string' },
    ui: { type: 'string' },
  },
})
if (!args.name || !args.rect) throw new Error('需要 --name 与 --rect x,y,w,h')
checkUi(args.ui)
const [x, y, w, h] = args.rect.split(',').map(Number)
const scale = Number(args.scale)
const variant = `${args.viewport}${args.dark ? '-dark' : ''}${args.theme ? `-${args.theme.replaceAll(',', '-')}` : ''}${args.ui && args.ui !== 'legacy' ? `-${args.ui}` : ''}`
const sources = ['old', 'new', 'diff'].map((dir) => PNG.sync.read(fs.readFileSync(path.join(outRoot, dir, variant, `${args.name}.png`))))

const gap = 6
const out = new PNG({ width: w * scale, height: (h * scale + gap) * sources.length - gap })
out.data.fill(255)
sources.forEach((src, n) => {
  const top = n * (h * scale + gap)
  for (let yy = 0; yy < h * scale; yy++) {
    for (let xx = 0; xx < w * scale; xx++) {
      const sx = x + Math.floor(xx / scale)
      const sy = y + Math.floor(yy / scale)
      if (sx >= src.width || sy >= src.height) continue
      const i = (sy * src.width + sx) * 4
      const j = ((top + yy) * out.width + xx) * 4
      for (let k = 0; k < 4; k++) out.data[j + k] = src.data[i + k]
    }
  }
})
const file = path.join(outRoot, 'crop.png')
fs.writeFileSync(file, PNG.sync.write(out))
console.log(`旧 / 新 / 差异（自上而下）：${file}`)
