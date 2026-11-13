#!/usr/bin/env node
// 有意修正的行为检查：只在新版上操作，逐项确认修正后的行为。
// 请求比对按集合比较，查不出「同样的请求多发一次」这类问题，这里直接数请求。
// 用法：node tools/visual-diff/fixes.mjs [--only filter-cancel,ticket-enter] [--target old]
//   --target old：在原版上执行（用来确认检查能发现原版的问题，原版应当不通过）
// 会真实调用后端（工单回复、保存系统配置、支付方式），结束后删除测试消息、恢复工单状态、配置文件与支付方式
// （检查可选 before / after：执行前准备、结束后恢复，before 的返回值传给 after；
//  intercept：返回 'abort' 在浏览器里中止请求，返回对象则作为模拟的响应）。M5 的检查在 fixes-config.mjs。
import { parseArgs } from 'node:util'
import { clickText, SELECT_OPTION } from './actions.mjs'
import { gotoRoute, launch, login, openPage, targets } from './lib.mjs'
import { configChecks } from './fixes-config.mjs'
import { addCondition, clickAlertLink, openFilter, rowMenu, search, sql } from './requests-user.mjs'

const { values: args } = parseArgs({ options: { only: { type: 'string' }, target: { type: 'string', default: 'new' } } })
const DRAWER = '.ant-drawer-open'
const MODAL = '.ant-modal-wrap:not([style*="display: none"])'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 抽屉里第 n 个条件（从 0 开始）的三个表单项：字段名、条件、欲检索内容 */
async function conditionGroups(page, n) {
  const groups = await (await page.$(DRAWER)).$$('.form-group')
  return groups.slice(n * 3, n * 3 + 3)
}
const inputValue = (group) => group.$eval('input', (el) => el.value)
const selectText = (group) => group.$eval('.ant-select', (el) => el.textContent.trim())
async function closeDrawer(page) {
  await clickText(page, `${DRAWER} button`, '取 消')
  await sleep(600)
}
/** 记录之后发往 path 的请求 */
function watch(page, path) {
  const list = []
  page.on('request', (r) => {
    if (r.url().includes(path) && r.method() !== 'OPTIONS') list.push({ url: r.url(), body: r.postData() ?? '' })
  })
  return list
}

const checks = {
  // 改了条件没点「检索」就取消，重新打开时仍是原来的条件
  'filter-cancel': {
    route: '/user',
    run: async (page, expect) => {
      await openFilter(page)
      await addCondition(page, { value: 'user1' })
      await search(page)
      await openFilter(page)
      const [, , value] = await conditionGroups(page, 0)
      await (await value.$('input')).click()
      await page.keyboard.type('9')
      await closeDrawer(page)
      await openFilter(page)
      expect('取消后重新打开，条件仍是 user1', await inputValue((await conditionGroups(page, 0))[2]), 'user1')
    },
  },
  // 每行的「条件」下拉按本行字段显示选项；删除前面的条件后，后面的输入框显示自己的内容
  'filter-rows': {
    route: '/user',
    run: async (page, expect) => {
      await openFilter(page)
      await addCondition(page, { field: '用户ID', value: '5' })
      await addCondition(page, { field: '流量', value: '10' })
      const [, condition] = await conditionGroups(page, 0)
      await condition.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await (await condition.$('.ant-select')).click()
      await sleep(400)
      const options = await page.$$eval(SELECT_OPTION, (els) =>
        els.filter((el) => el.getBoundingClientRect().height).map((el) => el.textContent.trim()),
      )
      expect('第 1 行（用户ID）的条件选项', options.join(' '), '= >= > < <=')
      await page.keyboard.press('Escape')
      await sleep(300)
      await (await page.$(`${DRAWER} .ant-divider .anticon-delete`)).click()
      await sleep(300)
      const [field, , value] = await conditionGroups(page, 0)
      expect('删除第 1 行后，剩下一行的字段名', await selectText(field), '流量')
      expect('删除第 1 行后，剩下一行的内容', await inputValue(value), '10')
      await closeDrawer(page)
    },
  },
  // 已有 1 个条件时点「TA的邀请」，过滤器里显示邀请人条件
  'invite-sync': {
    route: '/user',
    run: async (page, expect) => {
      await openFilter(page)
      await addCondition(page, { value: 'user' })
      await search(page)
      const id = await page.$eval('.ant-table-tbody tr.ant-table-row td:first-child', (el) => el.textContent.trim())
      await rowMenu(page, 0, 'TA的邀请')
      await sleep(800)
      await openFilter(page)
      const groups = await (await page.$(DRAWER)).$$('.form-group')
      expect('过滤器里的条件数', groups.length / 3, 1)
      expect('字段名', await selectText(groups[0]), '邀请人ID')
      expect('内容', await inputValue(groups[2]), id)
      await closeDrawer(page)
    },
  },
  // 清空邮箱后表单仍在（不变成加载图标）
  'edit-clear-email': {
    route: '/user',
    run: async (page, expect) => {
      await rowMenu(page, 1, '编辑')
      await sleep(1000)
      const email = await page.$(`${DRAWER} .ant-drawer-body input`)
      await email.click()
      await email.evaluate((el) => el.select())
      await page.keyboard.press('Backspace')
      await sleep(300)
      const state = await page.$eval(`${DRAWER} .ant-drawer-body`, (el) => ({
        email: el.querySelector('input')?.value ?? null,
        inputs: el.querySelectorAll('input').length,
        loading: Boolean(el.querySelector('.anticon-loading')),
      }))
      expect('清空邮箱后仍显示表单', state.inputs > 5 && !state.loading, true)
      expect('邮箱输入框已清空', state.email, '')
    },
  },
  // 关闭创建用户弹窗后，到期时间一起清空
  'create-date-reset': {
    route: '/user',
    run: async (page, expect) => {
      const open = async () => {
        await (await page.$('.anticon-user-add')).click()
        await sleep(800)
      }
      const dateInput = () => page.$(`${MODAL} input[placeholder^="请选择用户到期日期"]`)
      await open()
      await (await dateInput()).click()
      await sleep(300)
      // 原版 antd 3 的日期框是只读的，要在弹出面板的输入框里输入
      const panelInput = await page.$('.ant-calendar-input')
      if (panelInput) await panelInput.click()
      await page.keyboard.type('2026-12-31')
      await page.keyboard.press('Enter')
      await sleep(400)
      expect('选好的日期', await (await dateInput()).evaluate((el) => el.value), '2026-12-31')
      await clickText(page, `${MODAL} button`, '取 消')
      await sleep(800)
      await open()
      expect('重新打开后的日期', await (await dateInput()).evaluate((el) => el.value), '')
    },
  },
  // 回车发送后再按一次回车，不会重发上一条消息
  'ticket-enter': {
    route: '/ticket/5',
    after: () => {
      sql("DELETE FROM v2_ticket_message WHERE message LIKE '修正验证%'")
      sql('UPDATE v2_ticket SET reply_status = 1 WHERE id = 5')
    },
    run: async (page, expect) => {
      const replies = watch(page, '/ticket/reply')
      await page.click('.js-chat-input')
      await page.keyboard.type('修正验证')
      await page.keyboard.press('Enter')
      await sleep(1500)
      await page.keyboard.press('Enter')
      await sleep(1500)
      const withMessage = replies.filter((r) => r.body.includes('message='))
      expect('带消息内容的回复请求数', withMessage.length, 1)
    },
  },
  // 离开工单列表再回来，邮箱搜索框显示当前生效的邮箱
  'ticket-search-keep': {
    route: '/ticket',
    run: async (page, expect) => {
      await page.click('input[placeholder="输入邮箱搜索"]')
      await page.keyboard.type('user1@')
      await sleep(1000)
      await page.evaluate(() => {
        location.hash = '#/dashboard'
      })
      await sleep(1500)
      const tickets = watch(page, '/ticket/fetch')
      await page.evaluate(() => {
        location.hash = '#/ticket'
      })
      await sleep(1500)
      expect('回来后的搜索框', await page.$eval('input[placeholder="输入邮箱搜索"]', (el) => el.value), 'user1@')
      expect('列表按这个邮箱筛选', tickets.some((r) => r.url.includes('email=user1%40')), true)
    },
  },
  // 订单页第一次请求第 1 页；跨页跳转只在目标页请求一次
  'order-first-page': {
    route: '/dashboard',
    run: async (page, expect) => {
      const orders = watch(page, '/order/fetch')
      await page.evaluate(() => {
        location.hash = '#/order'
      })
      await sleep(1500)
      expect('第一次进入订单页的请求', orders[0]?.url.includes('current=1'), true)
    },
  },
  'jump-dashboard': {
    route: '/dashboard',
    run: async (page, expect) => {
      const orders = watch(page, '/order/fetch')
      await clickAlertLink(page, '佣金')
      await sleep(2000)
      expect('订单列表请求数', orders.length, 1)
      expect('请求带三个条件', orders[0]?.url.includes('filter[2]'), true)
    },
  },
  'jump-user-orders': {
    route: '/user',
    run: async (page, expect) => {
      const orders = watch(page, '/order/fetch')
      await rowMenu(page, 0, 'TA的订单')
      await sleep(2000)
      expect('订单列表请求数', orders.length, 1)
      expect('请求按用户筛选', orders[0]?.url.includes('filter[0][key]=user_id'), true)
    },
  },
  'jump-order-user': {
    route: '/order',
    run: async (page, expect) => {
      const links = await page.$$('.ant-table-tbody tr.ant-table-row td:first-child a')
      await links[5].click()
      await sleep(2000)
      const users = watch(page, '/user/fetch')
      await (await page.$(`${MODAL} .ant-col-18 a`)).click()
      await sleep(2000)
      expect('用户列表请求数', users.length, 1)
      expect('请求按邮箱筛选', users[0]?.url.includes('filter[0][key]=email'), true)
    },
  },
  // 「设备数」只在前端排序：请求不带 sort，当前页按在线设备数排列
  'device-sort': {
    route: '/user',
    run: async (page, expect) => {
      const users = watch(page, '/user/fetch')
      await clickText(page, '.ant-table-thead th', '设备数')
      await sleep(800)
      expect('请求不带排序字段', users.length === 1 && !users[0].url.includes('sort='), true)
      const counts = await page.$$eval('.ant-table-tbody tr.ant-table-row', (rows) =>
        rows.map((row) => {
          const cell = [...row.cells].find((td) => /^\d+ \/ /.test(td.textContent.trim()))
          return Number(cell?.textContent.split('/')[0])
        }),
      )
      expect('当前页按在线设备数升序', counts.every((n, i) => i === 0 || counts[i - 1] <= n), true)
    },
  },
}

Object.assign(checks, configChecks)
const names = args.only ? args.only.split(',') : Object.keys(checks)
const token = await login()
const browser = await launch()
let failed = 0
for (const name of names) {
  const check = checks[name]
  const results = []
  const expect = (label, actual, expected) => results.push({ label, actual, expected, ok: actual === expected })
  const context = check.before ? await check.before(token) : undefined
  const page = await openPage(browser, { token })
  if (check.intercept) {
    await page.setRequestInterception(true)
    page.on('request', (r) => {
      const action = r.method() === 'OPTIONS' ? undefined : check.intercept(r)
      if (action === 'abort') void r.abort()
      else if (action) void r.respond(action)
      else void r.continue()
    })
  }
  try {
    await gotoRoute(page, targets[args.target](), check.route, { settle: 1500 })
    await check.run(page, expect, token)
  } catch (e) {
    results.push({ label: `操作出错：${e.message}`, ok: false })
  } finally {
    await page.close()
    if (check.after) await check.after(context)
  }
  const ok = results.length > 0 && results.every((r) => r.ok)
  if (!ok) failed++
  console.log(`\n== ${name} ${ok ? '✓' : '✗'}`)
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.label}${'actual' in r ? `：${JSON.stringify(r.actual)}${r.ok ? '' : `（预期 ${JSON.stringify(r.expected)}）`}` : ''}`)
  }
}
await browser.close()
process.exitCode = failed ? 1 : 0
