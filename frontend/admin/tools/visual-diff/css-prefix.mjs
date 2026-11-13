#!/usr/bin/env node
// 样式改动不影响 legacy 的检查：编译 src/styles/index.scss，与修改前保存的编译结果比较。
// 皮肤的样式放在最后，所以修改后的 CSS 应以修改前的 CSS 开头（legacy 的规则逐字节相同），
// 追加的每条规则（按逗号拆开逐段）都在皮肤作用域 :where(html[data-v2b-ui=<皮肤>]) 里。
// 用法：node tools/visual-diff/css-prefix.mjs --save out/skin/scss/before.css        修改前保存
//        node tools/visual-diff/css-prefix.mjs --before out/skin/scss/before.css [--scope illustration,geek]
// 路径相对 tools/visual-diff/；--scope 默认取 lib.mjs 的全部皮肤
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import * as sass from 'sass-embedded'
import { projectRoot, SKIN_PRESETS } from './lib.mjs'

const { values: args } = parseArgs({
  options: { save: { type: 'string' }, before: { type: 'string' }, scope: { type: 'string' } },
})

const here = import.meta.dirname
const compiled = sass.compile(path.join(projectRoot, 'src/styles/index.scss'), {
  loadPaths: [path.join(projectRoot, 'node_modules')],
  style: 'expanded',
  quietDeps: true,
  logger: sass.Logger.silent,
}).css + '\n'

if (args.save) {
  fs.mkdirSync(path.dirname(path.resolve(here, args.save)), { recursive: true })
  fs.writeFileSync(path.resolve(here, args.save), compiled)
  console.log(`已保存 ${compiled.length} 字节：${args.save}`)
  process.exit(0)
}

const before = fs.readFileSync(path.resolve(here, args.before ?? 'out/skin/scss/before.css'), 'utf8')
if (!compiled.startsWith(before)) {
  let i = 0
  while (i < before.length && before[i] === compiled[i]) i++
  console.log(`前缀不一致（第 ${i} 个字符起）：\n--- 修改前\n${before.slice(i - 200, i + 200)}\n--- 修改后\n${compiled.slice(i - 200, i + 200)}`)
  process.exit(1)
}

const scopes = (args.scope?.split(',') ?? SKIN_PRESETS).map((name) => `data-v2b-ui=${name}]`)

/** 按最外层的逗号拆开选择器列表（:is(...)、:has(...) 里的逗号不拆） */
function splitSelectors(text) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += ch
  }
  parts.push(current.trim())
  return parts
}
const tail = compiled.slice(before.length)
const outside = []
let count = 0
let selector = ''
for (const ch of tail) {
  if (ch === '{') {
    const text = selector.trim()
    // @media 等条件规则、@keyframes 的帧不是选择器
    if (text && !text.startsWith('@') && !/^(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*$/.test(text)) {
      count++
      for (const part of splitSelectors(text)) {
        if (!scopes.some((scope) => part.includes(scope))) outside.push(part)
      }
    }
    selector = ''
  } else if (ch === '}' || ch === ';') selector = ''
  else selector += ch
}
console.log(`前缀一致；追加 ${tail.length} 字节、${count} 条规则；不在皮肤作用域里的选择器 ${outside.length} 个`)
for (const part of outside.slice(0, 20)) console.log(`  ${part}`)
process.exit(outside.length ? 1 : 0)
