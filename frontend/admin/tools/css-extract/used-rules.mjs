#!/usr/bin/env node
// 结合 coverage 区间（.umi-src/css/ranges-*.json）解析原版样式表，输出"实际命中的规则"（保留 @media 上下文），
// 作为新样式层的规格：.umi-src/css/used/<文件>.css，以及 .umi-src/css/used/index.json（选择器 → 声明）。
// 只读原版文件，结果仅存本地。用法：node tools/css-extract/used-rules.mjs
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'postcss'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const assetDir = path.resolve(projectRoot, '../v2b-demo/src/public/assets/admin')
const cssDir = path.join(projectRoot, '.umi-src/css')
const outDir = path.join(cssDir, 'used')
fs.mkdirSync(outDir, { recursive: true })

const files = ['umi.css', 'components.chunk.css', 'theme/default.css', 'theme/black.css', 'theme/darkblue.css', 'theme/green.css']

function loadRanges(base) {
  const all = []
  for (const f of fs.readdirSync(cssDir)) {
    if (f === `ranges-${base}.json` || (f.startsWith(`ranges-${base}.`) && f.endsWith('.json'))) {
      all.push(...JSON.parse(fs.readFileSync(path.join(cssDir, f), 'utf8')))
    }
  }
  return all.toSorted((a, b) => a.start - b.start)
}

function mediaContext(node) {
  const chain = []
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule') chain.unshift(`@${p.name} ${p.params}`)
  }
  return chain.join(' ')
}

const index = {}
for (const file of files) {
  const base = path.basename(file, '.css')
  const text = fs.readFileSync(path.join(assetDir, file), 'utf8')
  const ranges = loadRanges(base)
  if (!ranges.length) {
    console.log(`${file}: 没有 coverage 数据，跳过`)
    continue
  }
  const root = parse(text, { from: file })
  const usedAnimations = new Set()
  let kept = 0
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return
    const start = rule.source.start.offset
    const end = rule.source.end.offset + 1
    const used = ranges.some((r) => r.start < end && r.end > start)
    if (!used) {
      rule.remove()
      return
    }
    kept++
    rule.walkDecls(/^animation(-name)?$/, (d) => d.value.split(/[\s,]+/).forEach((v) => usedAnimations.add(v)))
    const key = `${mediaContext(rule)}|${rule.selector}`
    ;(index[key] ??= []).push({ file, decls: rule.nodes.filter((n) => n.type === 'decl').map((d) => `${d.prop}:${d.value}${d.important ? '!important' : ''}`) })
  })
  // 清理：未引用的 @keyframes、@font-face、空的 @media
  root.walkAtRules((at) => {
    if (at.name.endsWith('keyframes') && !usedAnimations.has(at.params)) at.remove()
    else if (at.name === 'font-face') at.remove()
  })
  let changed = true
  while (changed) {
    changed = false
    root.walkAtRules((at) => {
      if (!at.name.endsWith('keyframes') && at.nodes && at.nodes.length === 0) {
        at.remove()
        changed = true
      }
    })
  }
  // 可读格式：每条规则一行
  const lines = []
  root.each(function print(node, _i, indent = '') {
    if (node.type === 'rule') lines.push(`${indent}${node.selector} { ${node.nodes.map((d) => d.toString()).join('; ')} }`)
    else if (node.type === 'atrule') {
      lines.push(`${indent}@${node.name} ${node.params} {`)
      node.each((child) => print(child, 0, `${indent}  `))
      lines.push(`${indent}}`)
    }
  })
  fs.writeFileSync(path.join(outDir, `${base}.css`), `${lines.join('\n')}\n`)
  console.log(`${file}: 命中规则 ${kept} 条 → .umi-src/css/used/${base}.css`)
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1))
