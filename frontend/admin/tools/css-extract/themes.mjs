#!/usr/bin/env node
// 从原版 theme/{default,black,darkblue,green}.css 生成 src/styles/themes/_<主题>.scss：
//   - 只保留管理端 DOM 里实际出现的 class / id 相关的规则（class 名来自 umi.js 解包结果 .umi-src/index.json）
//   - 全局元素规则只保留颜色相关（a / h1-h6 / body / hr / ::selection）
//   - antd 组件着色交给 antd 6 的 token，这里全部跳过
//   - 保留原文件中的先后顺序（原版主题文件里 Dashmix 段与 antd 段的先后不同，会影响最终颜色）
//   - 用 :where(html[data-v2b-color=...]) 限定作用域，不增加选择器优先级
// 用法：node tools/css-extract/themes.mjs（先运行 pnpm umi:extract）
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'postcss'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const themeDir = path.resolve(projectRoot, '../v2b-demo/src/public/assets/admin/theme')
const outDir = path.join(projectRoot, 'src/styles/themes')
fs.mkdirSync(outDir, { recursive: true })

const index = JSON.parse(fs.readFileSync(path.join(projectRoot, '.umi-src/index.json'), 'utf8'))
const usedClasses = new Set(index.filter((m) => m.isApp).flatMap((m) => m.classNames))
// 原版里有些 class 是拼接出来的（如 sidebar-dark / page-header-dark），className 字面量统计不到；
// 这里再把新版源码里出现的所有字符串 token 加进来（新版 DOM 与原版一致）
function walkSrc(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkSrc(full)
    else if (/\.tsx?$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8')
      // 引号字符串（包括模板字符串 ${} 里的，例如 `nav-main-link${active ? ' active' : ''}` 的 active）与模板字符串的静态部分
      const strings = [
        ...[...text.matchAll(/(['"])((?:(?!\1).)*)\1/g)].map((m) => m[2]),
        ...[...text.matchAll(/`([^`]*)`/g)].map((m) => m[1].replaceAll(/\$\{[^}]*\}/g, ' ')),
      ]
      for (const s of strings) {
        for (const token of s.split(/\s+/)) if (/^[a-z][a-z0-9-]*$/.test(token)) usedClasses.add(token)
      }
    }
  }
}
walkSrc(path.join(projectRoot, 'src'))
// 布局里用到的 id
const usedIds = new Set(['page-container', 'sidebar', 'page-header', 'main-container'])

const ANTD = /\.ant-|anticon|\[ant-|antd-pro|(^|[\s,.])(fade|zoom|move|slide|swing|show-help)-(enter|leave|appear)/
const GLOBAL_ELEMENTS = /^(html|body|a|a:hover|a:active|a:focus|hr|::selection|h[1-6]|\.h[1-6])$/
const GLOBAL_COLOR_PROPS = /^(color|background|background-color|border-top-color|--antd-wave-shadow-color|font-size|font-family|font-variant|font-feature-settings|line-height)$/

function keepSelector(selector) {
  if (ANTD.test(selector)) return false
  const simple = selector.trim()
  if (GLOBAL_ELEMENTS.test(simple)) return true
  const classes = [...simple.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1])
  const ids = [...simple.matchAll(/#([A-Za-z0-9_-]+)/g)].map((m) => m[1])
  if (!classes.length && !ids.length) return false
  return classes.every((c) => usedClasses.has(c)) && ids.every((i) => usedIds.has(i))
}

function scope(selector, theme) {
  const s = selector.trim()
  if (s === 'html') return `html:where([data-v2b-color='${theme}'])`
  return `:where(html[data-v2b-color='${theme}']) ${s}`
}

for (const theme of ['default', 'black', 'darkblue', 'green']) {
  const root = parse(fs.readFileSync(path.join(themeDir, `${theme}.css`), 'utf8'))
  const out = []
  const emit = (rule, indent = '') => {
    const selectors = rule.selectors.filter(keepSelector)
    if (!selectors.length) return
    const isGlobal = selectors.every((s) => GLOBAL_ELEMENTS.test(s.trim()))
    const decls = rule.nodes.filter((d) => d.type === 'decl' && (!isGlobal || GLOBAL_COLOR_PROPS.test(d.prop)))
    if (!decls.length) return
    out.push(`${indent}${selectors.map((s) => scope(s, theme)).join(',\n' + indent)} {`)
    for (const d of decls) out.push(`${indent}  ${d.prop}: ${d.value}${d.important ? ' !important' : ''};`)
    out.push(`${indent}}`)
  }
  for (const node of root.nodes) {
    if (node.type === 'rule') emit(node)
    else if (node.type === 'atrule' && node.name === 'media') {
      const start = out.length
      out.push(`@media ${node.params} {`)
      node.each((child) => child.type === 'rule' && emit(child, '  '))
      if (out.length === start + 1) out.pop()
      else out.push('}')
    }
  }
  const header = `// 由 tools/css-extract/themes.mjs 从原版 theme/${theme}.css 生成（仅管理端用到的规则），请勿手改。\n`
  fs.writeFileSync(path.join(outDir, `_${theme}.scss`), `${header}${out.join('\n')}\n`)
  console.log(`${theme}: ${out.filter((l) => l.endsWith('{') && !l.startsWith('@')).length} 条规则 → src/styles/themes/_${theme}.scss`)
}
