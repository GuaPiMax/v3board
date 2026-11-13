#!/usr/bin/env node
// 按需加载检查：首屏只下载当前页面的代码、空闲时预加载其余页面和 darkreader、切换页面不再下载、
// 暗黑模式在首次渲染前生效且可以切换；--target prod 时再模拟页面文件下载失败（重新部署后旧文件被删除），
// 应自动刷新并打开要去的页面。
// 用法：node tools/visual-diff/lazy.mjs [--target new|prod]
//   new = pnpm dev（5173）；prod = 打包产物（pnpm build 后 pnpm preview，4173，或 V2B_PROD 指定的地址）
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { launch, login, openPage, projectRoot, targets } from './lib.mjs'

const { values: args } = parseArgs({ options: { target: { type: 'string', default: 'new' } } })
const base = targets[args.target]()
const token = await login()
const browser = await launch()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 页面包：开发时是 src/pages/**/XxxPage.tsx，打包后是 assets/XxxPage-<hash>.js；页面数按 router.tsx 里的 page(() => import(…)) 统计
const PAGE_COUNT = fs.readFileSync(path.join(projectRoot, 'src/app/router.tsx'), 'utf8').match(/page\(\(\) => import\(/g).length
const pageName = (url) => new URL(url).pathname.match(/\/(\w+Page)(?:-[\w-]+)?\.(?:js|tsx)$/)?.[1]

let failures = 0
function check(label, ok, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? '通过' : '失败'}  ${label}${detail ? `：${detail}` : ''}`)
}

async function open({ route, dark = false, auth = true }) {
  const page = await openPage(browser, { token: auth ? token : null, dark })
  const logs = []
  const scripts = []
  page.on('console', (m) => ['warn', 'warning', 'error'].includes(m.type()) && logs.push(m.text().slice(0, 160)))
  page.on('pageerror', (e) => logs.push(e.message.slice(0, 160)))
  page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()))
  // 记录 #root 第一次有内容的时刻，以及当时是否已经应用暗黑模式
  await page.evaluateOnNewDocument(() => {
    new MutationObserver((_, observer) => {
      if (!document.getElementById('root')?.firstChild) return
      window.v2bFirstRender = { at: performance.now(), dark: !!document.querySelector('style.darkreader') }
      observer.disconnect()
    }).observe(document, { childList: true, subtree: true })
  })
  if (route) await page.goto(`${base}#${route}`, { waitUntil: 'networkidle0' })
  return { page, logs, scripts }
}
// 首次渲染前开始下载的页面包
const pagesBeforeFirstRender = (page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.startTime < window.v2bFirstRender.at)
      .map((e) => e.name),
  )
const pagesOf = (urls) => [...new Set(urls.map(pageName).filter(Boolean))].toSorted()
// 开发环境的已知告警（为保持原版 DOM 结构有意保留的 antd 弃用组件）
const unexpected = (logs) => logs.filter((l) => !/is deprecated|should not be `null`/.test(l))

async function clickMenu(page, name) {
  await page.evaluate((text) => {
    ;[...document.querySelectorAll('.nav-main-link')].find((a) => a.textContent.trim() === text).click()
  }, name)
}

{
  const { page, logs, scripts } = await open({ route: '/login', auth: false })
  await sleep(3000)
  check('登录页渲染', await page.evaluate(() => !!document.querySelector('input[type=password]')))
  const first = pagesOf(await pagesBeforeFirstRender(page))
  check('登录页首屏只下载登录页', first.join() === 'LoginPage', first.join())
  check('空闲后预加载全部页面', pagesOf(scripts).length === PAGE_COUNT, `${pagesOf(scripts).length} 个`)
  check('预加载 darkreader', scripts.some((s) => /darkreader/.test(s)))
  check('控制台没有告警', unexpected(logs).length === 0, unexpected(logs).join(' | '))
  await page.close()
}

{
  const { page, logs, scripts } = await open({ route: '/dashboard' })
  await sleep(3000)
  const first = pagesOf(await pagesBeforeFirstRender(page))
  check('仪表盘首屏只下载仪表盘', first.join() === 'DashboardPage', first.join())
  check('仪表盘图表渲染', (await page.evaluate(() => document.querySelectorAll('#main-container svg, #main-container canvas').length)) > 0)
  for (const [menu, hash] of [
    ['用户管理', '#/user'],
    ['节点管理', '#/server/manage'],
    ['知识库管理', '#/knowledge'],
    ['系统配置', '#/config/system'],
    ['支付配置', '#/config/payment'],
  ]) {
    const before = scripts.length
    await clickMenu(page, menu)
    await page.waitForFunction((h) => location.hash === h, { timeout: 5000 }, hash)
    await page.waitForFunction(() => document.querySelector('#main-container .block'), { timeout: 5000 })
    check(`切换到${menu}不再下载`, scripts.length === before, `${scripts.length - before} 个脚本`)
  }
  check('控制台没有告警', unexpected(logs).length === 0, unexpected(logs).join(' | '))
  await page.close()
}

{
  const { page, logs } = await open({ route: '/dashboard', dark: true })
  await sleep(800)
  check('暗黑模式在首次渲染前生效', await page.evaluate(() => window.v2bFirstRender.dark))
  const state = () =>
    page.evaluate(() => ({
      cookie: document.cookie.match(/dark_mode=(\d)/)?.[1],
      dark: document.querySelectorAll('style.darkreader').length > 0,
      icon: document.querySelector('.fa-moon') ? 'moon' : 'sun',
    }))
  await page.evaluate(() => document.querySelector('.fa-moon').closest('button').click())
  await sleep(500)
  const off = await state()
  check('关闭暗黑模式', off.cookie === '0' && !off.dark && off.icon === 'sun', JSON.stringify(off))
  await page.evaluate(() => document.querySelector('.fa-sun').closest('button').click())
  await sleep(800)
  const on = await state()
  check('打开暗黑模式', on.cookie === '1' && on.dark && on.icon === 'moon', JSON.stringify(on))
  check('控制台没有告警', unexpected(logs).length === 0, unexpected(logs).join(' | '))
  await page.close()
}

if (args.target === 'prod') {
  const { page, logs } = await open({})
  await page.setRequestInterception(true)
  let failed = 0
  page.on('request', (r) => {
    if (/UserPage-/.test(r.url()) && failed++ === 0) return r.respond({ status: 404, body: 'not found' })
    return r.continue()
  })
  await page.goto(`${base}#/dashboard`, { waitUntil: 'networkidle0' })
  await sleep(3000)
  await page.evaluate(() => (window.v2bBeforeReload = true))
  await clickMenu(page, '用户管理')
  await page.waitForFunction(() => !window.v2bBeforeReload && document.querySelector('.ant-table'), { timeout: 10000 }).catch(() => {})
  const result = await page.evaluate(() => ({
    hash: location.hash,
    reloaded: !window.v2bBeforeReload,
    table: !!document.querySelector('.ant-table'),
  }))
  check(
    '页面文件下载失败时刷新并打开要去的页面',
    result.reloaded && result.hash === '#/user' && result.table,
    JSON.stringify(result),
  )
  check('只有模拟的 404', logs.every((l) => /404/.test(l)), logs.join(' | '))
  await page.close()
}

await browser.close()
console.log(failures ? `${failures} 项失败` : '全部通过')
process.exitCode = failures ? 1 : 0
