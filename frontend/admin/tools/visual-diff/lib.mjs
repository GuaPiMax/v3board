// visual-diff 公共逻辑：用本机 Chrome（puppeteer-core，不下载浏览器）打开新 / 旧管理端。
import fs from 'node:fs'
import path from 'node:path'
import { launch as launchBrowser } from 'puppeteer-core'

export const projectRoot = path.resolve(import.meta.dirname, '../..')
export const outRoot = path.join(projectRoot, 'tools/visual-diff/out')

export const config = {
  chrome: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // 后端（旧管理端也由它提供）
  apiOrigin: process.env.V2B_API ?? 'http://localhost:6600',
  securePath: process.env.V2B_SECURE_PATH ?? 'devadmin123',
  email: process.env.V2B_ADMIN_EMAIL ?? 'admin@example.com',
  password: process.env.V2B_ADMIN_PASSWORD ?? 'admin123456',
  // 新管理端（pnpm dev）
  newOrigin: process.env.V2B_NEW ?? 'http://localhost:5173',
  // 新管理端的打包产物（pnpm build 后 pnpm preview，或同源部署的地址，末尾不带 /）
  prodOrigin: process.env.V2B_PROD ?? 'http://localhost:4173',
}

export const targets = {
  old: () => `${config.apiOrigin}/${config.securePath}`,
  new: () => `${config.newOrigin}/`,
  prod: () => `${config.prodOrigin}/`,
}

export const viewports = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
}
export const mobileUA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

export async function login() {
  const body = new URLSearchParams({ email: config.email, password: config.password })
  const res = await fetch(`${config.apiOrigin}/api/v1/passport/auth/login`, { method: 'POST', body })
  const json = await res.json()
  if (!json.data?.auth_data) throw new Error(`登录失败：${JSON.stringify(json)}`)
  return json.data.auth_data
}

export async function launch() {
  return launchBrowser({
    executablePath: config.chrome,
    headless: true,
    // 同一个 profile 不能同时被两个 Chrome 使用；需要并行运行时用 V2B_CHROME_PROFILE 指定另一个目录
    userDataDir: process.env.V2B_CHROME_PROFILE ?? path.join(projectRoot, 'tools/visual-diff/.chrome-profile'),
    args: ['--hide-scrollbars', '--font-render-hinting=none', '--force-color-profile=srgb'],
  })
}

/**
 * 打开一个页面：注入 token / 主题覆盖 / 暗黑 cookie，并关闭动画，保证截图稳定。
 * theme: { sidebar, header, color } 会在旧版 blade 给 window.settings 赋值时被覆盖。
 * ui：新版的界面预设，默认 legacy（与原版比对只在 legacy 下有意义）。新版存在 localStorage v2b_ui（顶栏的主题按钮切换），
 * 每个标签页在第一次加载前写入（profile 是持久的，每次都要写，不能沿用上次留下的值；同一标签页里刷新后保持页面自己改过的值，
 * 可以检查「切换后刷新仍保持」）；修改前的打包产物读 config.js 的 ui，同时在 window.settings 上覆盖（旧版没有这个设置，不受影响）。
 * uiSwitch：显示顶栏的主题按钮（原版没有）。默认隐藏，现有的状态与原版、各基准逐像素对照；截主题按钮的状态时打开。
 * transitions: true 时保留过渡与动画（检查拖动排序的动画时使用）。
 */
export async function openPage(
  browser,
  { token, viewport = 'desktop', theme, dark = false, ui = 'legacy', uiSwitch = false, transitions = false } = {},
) {
  const page = await browser.newPage()
  await page.setViewport(viewports[viewport])
  if (viewport === 'mobile') await page.setUserAgent(mobileUA)
  await page.evaluateOnNewDocument(
    (tokenValue, themeOverride, uiOverride, showUiSwitch, keepTransitions) => {
      try {
        if (tokenValue) localStorage.setItem('authorization', tokenValue)
        else localStorage.removeItem('authorization')
      } catch {}
      try {
        if (uiOverride && !sessionStorage.getItem('v2b_tool_ui')) {
          localStorage.setItem('v2b_ui', uiOverride)
          sessionStorage.setItem('v2b_tool_ui', '1')
        }
      } catch {}
      if (!showUiSwitch) {
        const hide = document.createElement('style')
        hide.id = 'v2b-tool-hide-ui-switch'
        hide.textContent = '.v2b-ui-switch{display:none!important}'
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(hide))
      }
      if (themeOverride || uiOverride) {
        // 旧版：blade 里 window.settings = {...}；新版：config.js 里 window.settings = {...}
        let current
        Object.defineProperty(window, 'settings', {
          configurable: true,
          get: () => current,
          set: (v) => {
            current = v && { ...v, ...(themeOverride && { theme: { ...v.theme, ...themeOverride } }), ...(uiOverride && { ui: uiOverride }) }
          },
        })
      }
      if (themeOverride) {
        try {
          localStorage.setItem('v2b_theme_override', JSON.stringify(themeOverride))
        } catch {}
      }
      if (keepTransitions) return
      // 只关闭过渡，保留动画（antd 6 的弹窗依赖 animationend 结束入场状态）；截图前会等待动画播放完。
      // 循环动画（Badge「运行中」状态点的波纹）停在初始状态，否则每次截图的相位不同
      const style = document.createElement('style')
      style.textContent =
        '*,*::before,*::after{transition:none!important;caret-color:transparent!important}' +
        '.ant-badge-status-processing::after{animation:none!important}'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    },
    token ?? null,
    theme ?? null,
    ui ?? null,
    uiSwitch,
    transitions,
  )
  const url = new URL(config.apiOrigin)
  await page.setCookie({ name: 'dark_mode', value: dark ? '1' : '0', domain: url.hostname, path: '/' })
  return page
}

export async function gotoRoute(page, base, route, { settle = 1200 } = {}) {
  await page.goto(`${base}#${route}`, { waitUntil: 'networkidle0', timeout: 30000 })
  // hash 路由在同一文档内切换时 networkidle 可能已满足，额外等待渲染（图表有过渡）
  await new Promise((r) => setTimeout(r, settle))
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// 新版的界面预设（与 src/app/uiPreset.ts、src/app/skins/index.ts 的注册表一致；新增皮肤时在这里登记；modern 已去掉）。
// 皮肤的暗黑模式是自己设计的暗色版（<html data-v2b-dark>），不用 darkreader；ALWAYS_DARK 为固定暗色的皮肤
export const SKIN_PRESETS = ['illustration', 'geek']
export const ALWAYS_DARK = ['geek']
export const UI_PRESETS = ['legacy', ...SKIN_PRESETS]

/** 校验 --ui 参数（不认识的值新版会按 legacy 打开，截图会拍错预设） */
export function checkUi(ui) {
  if (ui !== undefined && !UI_PRESETS.includes(ui)) throw new Error(`--ui 只能是 ${UI_PRESETS.join(' / ')}，收到 ${ui}`)
  return ui
}

/** 核对页面实际使用的界面预设与暗色（新版页面上的 <html data-v2b-ui> / data-v2b-dark） */
export async function assertPreset(page, { ui = 'legacy', dark = false } = {}) {
  const actual = await page.evaluate(() => ({
    ui: document.documentElement.dataset.v2bUi,
    dark: 'v2bDark' in document.documentElement.dataset,
  }))
  if (actual.ui !== ui) throw new Error(`页面的界面预设是 ${actual.ui}，不是 ${ui}`)
  const expectDark = SKIN_PRESETS.includes(ui) && (dark || ALWAYS_DARK.includes(ui))
  if (actual.dark !== expectDark) throw new Error(`页面${actual.dark ? '是' : '不是'}皮肤的暗色版，应该${expectDark ? '是' : '不是'}`)
}
