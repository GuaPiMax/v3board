#!/usr/bin/env node
// 从原版管理端 umi.js（只读）拆出 webpack 模块，解码 \uXXXX 中文，生成移植参考：
//   .umi-src/modules/<id>.js   单个模块源码（已解码）
//   .umi-src/index.json        模块索引（行号、依赖、是否业务代码）
//   .umi-src/routes.json       路由 → 页面模块
//   .umi-src/models.json       dva model namespace → 模块
//   .umi-src/packets/<name>.md 每个页面 / model 的移植包（依赖、接口、class 名、中文文案）
// 用法：pnpm umi:extract [umi.js 路径]（默认读 ../v2b-demo/src 里 wyx2685/v2board 的原版管理端）
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const umiPath = path.resolve(
  process.argv[2] ?? path.join(projectRoot, '../v2b-demo/src/public/assets/admin/umi.js'),
)
const outDir = path.join(projectRoot, '.umi-src')

const source = fs.readFileSync(umiPath, 'utf8')
const lines = source.split('\n')

const decode = (text) =>
  text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
const fileNameOf = (id) => `${encodeURIComponent(id)}.js`
// 拼进正则的文本：转义全部元字符（包括反斜杠）
const escapeRegExp = (text) => text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')

// ---- 1. 按顶层 key 拆分模块（格式化后的 bundle：4 空格缩进的 `id: function(...)`）----
const startRe = /^ {4}(?:"([^"]+)"|([A-Za-z0-9_$]+)): function\(([^)]*)\)/
const modules = []
for (let i = 0; i < lines.length; i++) {
  const m = startRe.exec(lines[i])
  if (m) modules.push({ id: m[1] ?? m[2], params: m[3].split(',').map((s) => s.trim()), start: i })
}
modules.forEach((m, idx) => {
  m.end = idx + 1 < modules.length ? modules[idx + 1].start : lines.length
})

const byId = new Map()
for (const m of modules) {
  const text = decode(lines.slice(m.start, m.end).join('\n'))
  const requireName = m.params[2]
  const deps = new Set()
  if (requireName) {
    const re = new RegExp(`\\b${escapeRegExp(requireName)}\\("([^"]+)"\\)`, 'g')
    for (const d of text.matchAll(re)) deps.add(d[1])
  }
  const chinese = [...new Set([...text.matchAll(/"([^"\n]*[一-龥][^"\n]*)"/g)].map((x) => x[1]))]
  const classNames = [
    ...new Set(
      [...text.matchAll(/class(?:Name)?:\s*"([^"]+)"/g)].flatMap((x) => x[1].split(/\s+/).filter(Boolean)),
    ),
  ]
  // 管理接口：常见写法 "/" + window.settings.secure_path + "/xxx" 或 "/".concat(window.settings.secure_path, "/xxx")
  const endpoints = [
    ...new Set(
      [...text.matchAll(/secure_path\s*(?:\+\s*|,\s*)"(\/[A-Za-z0-9_/]+)"/g)].map((x) => `/{secure_path}${x[1]}`),
    ),
  ]
  const bareEndpoints = [
    ...new Set(
      [...text.matchAll(/"(\/(?:passport|user|guest|monitor)\/[A-Za-z0-9_/]+)"/g)].map((x) => x[1]),
    ),
  ]
  const isApp = chinese.length > 0 || /window\.settings|dispatch\(|namespace:/.test(text)
  byId.set(m.id, {
    id: m.id,
    file: `modules/${fileNameOf(m.id)}`,
    lines: [m.start + 1, m.end],
    size: m.end - m.start,
    deps: [...deps],
    isApp,
    chinese,
    classNames,
    endpoints: [...endpoints, ...bareEndpoints],
    text,
  })
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(path.join(outDir, 'modules'), { recursive: true })
fs.mkdirSync(path.join(outDir, 'packets'), { recursive: true })
for (const m of byId.values()) fs.writeFileSync(path.join(outDir, m.file), m.text)

// ---- 2. 路由表（模块 i4x8：path + component: n("id").default）----
const routesModule = [...byId.values()].find((m) => m.text.includes('window.g_routes = u'))
const routes = routesModule
  ? [...routesModule.text.matchAll(/path:\s*"([^"]+)",[\s\S]*?component:\s*\w+\("([^"]+)"\)\.default/g)].map(
      (x) => ({ path: x[1], module: x[2] }),
    )
  : []

// ---- 3. dva model（u.model(i()({ namespace: "xxx" }, n("id").default))）----
const modelModule = [...byId.values()].find((m) => /\.model\(\w+\(\)\(\{\s*namespace:/.test(m.text))
const models = modelModule
  ? [...modelModule.text.matchAll(/namespace:\s*"([^"]+)"\s*\},\s*\w+\("([^"]+)"\)\.default/g)].map((x) => ({
      namespace: x[1],
      module: x[2],
    }))
  : []

// ---- 4. 移植包：页面 / model 及其业务依赖闭包 ----
function appClosure(rootId) {
  const seen = new Set()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) continue
    const m = byId.get(id)
    if (!m) continue
    if (id !== rootId && !m.isApp) continue
    seen.add(id)
    stack.push(...m.deps)
  }
  return [...seen]
}

function writePacket(name, rootId, title) {
  const ids = appClosure(rootId)
  const mods = ids.map((id) => byId.get(id))
  const all = (key) => [...new Set(mods.flatMap((m) => m[key]))]
  const md = [
    `# ${title}`,
    '',
    `入口模块：\`${rootId}\`（umi.js 第 ${byId.get(rootId)?.lines.join('-')} 行）`,
    '',
    '## 业务模块闭包',
    ...mods.map((m) => `- \`${m.id}\` L${m.lines[0]}-${m.lines[1]}（${m.size} 行）→ .umi-src/${m.file}`),
    '',
    '## 接口',
    ...all('endpoints').map((e) => `- ${e}`),
    '',
    '## class 名',
    all('classNames').join(' '),
    '',
    '## 中文文案',
    ...all('chinese').map((s) => `- ${s}`),
    '',
  ].join('\n')
  fs.writeFileSync(path.join(outDir, 'packets', `${name}.md`), md)
}

for (const r of routes) {
  const name = `route${r.path.replace(/[/:]+/g, '_')}`.replace(/_$/, '') || 'route_root'
  writePacket(name, r.module, `路由 ${r.path}`)
}
for (const m of models) writePacket(`model_${m.namespace}`, m.module, `dva model ${m.namespace}`)

const index = [...byId.values()].map(({ text, ...rest }) => rest)
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2))
fs.writeFileSync(path.join(outDir, 'routes.json'), JSON.stringify(routes, null, 2))
fs.writeFileSync(path.join(outDir, 'models.json'), JSON.stringify(models, null, 2))

console.log(
  `模块 ${byId.size} 个（业务 ${index.filter((m) => m.isApp).length}），路由 ${routes.length} 条，model ${models.length} 个 → ${path.relative(projectRoot, outDir)}/`,
)
