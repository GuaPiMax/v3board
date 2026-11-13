#!/usr/bin/env node
// 截图：同一页面 / 状态分别在旧版（后端提供的 umi.js 管理端）与新版（pnpm dev）截取整页图。
// 用法：node tools/visual-diff/capture.mjs [--target old|new|prod|both] [--viewport desktop|mobile] [--only a,b,prefix*] [--dark]
//        [--theme <sidebar>,<header>,<color>]   例如 --theme dark,light,black
//        [--ui illustration|geek]   新版使用的界面预设（lib.mjs 的 UI_PRESETS；没有原版可比，配合 --target new / prod）。
//        打开页面后核对 <html data-v2b-ui>（皮肤加 --dark 时再核对 data-v2b-dark；固定暗色的 geek 不用加 --dark，始终核对），预设不对的状态记为失败
// --theme 会通过管理接口临时修改后端「个性化」配置（新旧版都从后端读取主题），截图结束后恢复。
//        [--out <目录>]  输出到 out/<目录>/ 而不是 out/<target>/（例如修改前后分别截打包产物时区分两组，配合 V2B_PROD 指定地址）
// 顶栏的主题按钮（原版没有）默认隐藏；带 uiSwitch 的状态（header-ui-switch*）显示它，只截新版。
// 输出：tools/visual-diff/out/<--out 或 target>/<viewport>[-dark][-<theme>][-<ui>]/<name>.png
import path from 'node:path'
import { parseArgs } from 'node:util'
import { routes } from './routes.mjs'
import { assertPreset, checkUi, config, ensureDir, gotoRoute, launch, login, openPage, outRoot, targets } from './lib.mjs'
import { sql } from './requests-user.mjs'

const { values: args } = parseArgs({
  options: {
    target: { type: 'string', default: 'both' },
    viewport: { type: 'string', default: 'desktop' },
    only: { type: 'string' },
    dark: { type: 'boolean', default: false },
    all: { type: 'boolean', default: false },
    theme: { type: 'string' },
    ui: { type: 'string' },
    out: { type: 'string' },
  },
})

checkUi(args.ui)
const only = args.only?.split(',')
// 登录页放最后：新版登录页的主题来自登录后缓存的后端配置
const list = routes
  .filter((r) => (only ? only.some((o) => (o.endsWith('*') ? r.name.startsWith(o.slice(0, -1)) : r.name === o)) : args.all || !r.coverageOnly))
  .filter((r) => !r.mobileOnly || args.viewport === 'mobile')
  .filter((r) => !r.desktopOnly || args.viewport === 'desktop')
  .toSorted((a, b) => Number(a.auth === false) - Number(b.auth === false))
const which = args.target === 'both' ? ['old', 'new'] : [args.target]
const token = await login()

const adminApi = `${config.apiOrigin}/api/v1/${config.securePath}`
async function saveConfig(values) {
  const res = await fetch(`${adminApi}/config/save`, {
    method: 'POST',
    headers: { authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  })
  if (!res.ok) throw new Error(`保存配置失败：${res.status} ${await res.text()}`)
}
const saveFrontend = saveConfig
async function fetchConfig(key) {
  const res = await fetch(`${adminApi}/config/fetch?key=${key}`, { headers: { authorization: token } })
  return (await res.json()).data[key]
}
// 状态的 setup / teardown：截图前后调用管理接口或直接改库，准备、恢复数据（例如打开系统配置的子项）；
// setup 的返回值会传给 teardown
const api = { saveConfig, fetchConfig, sql }
let restoreTheme
if (args.theme) {
  const [sidebar, header, color] = args.theme.split(',')
  const res = await fetch(`${adminApi}/config/fetch?key=frontend`, { headers: { authorization: token } })
  const frontend = (await res.json()).data.frontend
  restoreTheme = {
    frontend_theme_sidebar: frontend.frontend_theme_sidebar ?? 'light',
    frontend_theme_header: frontend.frontend_theme_header ?? 'dark',
    frontend_theme_color: frontend.frontend_theme_color ?? 'default',
  }
  await saveFrontend({ frontend_theme_sidebar: sidebar, frontend_theme_header: header, frontend_theme_color: color })
}

const browser = await launch()
const variant = `${args.viewport}${args.dark ? '-dark' : ''}${args.theme ? `-${args.theme.replaceAll(',', '-')}` : ''}${args.ui && args.ui !== 'legacy' ? `-${args.ui}` : ''}`

for (const target of which) {
  const dir = ensureDir(path.join(outRoot, args.out ?? target, variant))
  for (const r of list) {
    // 顶栏的主题按钮原版没有
    if (r.uiSwitch && target === 'old') continue
    const context = r.setup ? await r.setup(api) : undefined
    const page = await openPage(browser, {
      token: r.auth === false ? null : token,
      viewport: args.viewport,
      dark: args.dark,
      ui: args.ui,
      uiSwitch: r.uiSwitch,
    })
    try {
      await gotoRoute(page, targets[target](), r.route, { settle: r.settle })
      // 新版：核对实际打开的界面预设（旧版没有这个属性）
      if (target !== 'old') await assertPreset(page, { ui: args.ui, dark: args.dark })
      if (r.state) await r.state(page)
      // 页面不超过一屏时不用 fullPage：整页截图会临时改变视口尺寸，antd 6 的弹层（下拉菜单等）会因此重新对齐甚至翻转；
      // viewportOnly 的状态（图表的提示框等）只截当前视口
      const fullPage = !r.viewportOnly && (await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight))
      await page.screenshot({ path: path.join(dir, `${r.name}.png`), fullPage })
      console.log(`${target} ${r.name}`)
    } catch (e) {
      console.error(`${target} ${r.name} 失败：${e.message}`)
    } finally {
      await page.close()
      if (r.teardown) await r.teardown(api, context)
    }
  }
}
await browser.close()
if (restoreTheme) await saveFrontend(restoreTheme)
