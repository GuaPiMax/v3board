#!/usr/bin/env node
// 请求一致性：在新旧版执行同样的操作，记录发往后端的请求（方法、路径、Content-Type、请求体），逐项比对。
// 用法：node tools/visual-diff/requests.mjs [--only dashboard,notice-create-drop]
// 注意：会真实调用后端（创建后立即删除测试公告、切换后恢复显示状态），只用于本地开发环境。
// 场景可选：before / between / after（直接调用接口或改库，准备、在新版执行前重置、恢复数据）、
// fixOld（有意修正：把旧版请求改写成预期，返回 null 表示不再发出）、normalize（统一替换两边不同的值）、
// knownNewOnly（新版多出的已知请求）、abort（匹配的请求照常记录，但在浏览器里中止、不发到后端）
import { parseArgs } from 'node:util'
import { clickText, dragRow, FIXED_END_LINK, SELECT_OPTION, visibleDrawer } from './actions.mjs'
import { serverManageScenarios } from './requests-server.mjs'
import { configScenarios } from './requests-config.mjs'
import { orderScenarios, ticketScenarios, userScenarios } from './requests-user.mjs'
import path from 'node:path'
import { config, gotoRoute, launch, login, openPage, outRoot, targets } from './lib.mjs'

const { values: args } = parseArgs({ options: { only: { type: 'string' }, verbose: { type: 'boolean', default: false } } })

// 已知差异：新版登录后额外读取主题与站点配置（原版由后端模板注入）
const KNOWN_NEW_ONLY = [/config\/fetch\?key=frontend /, /config\/fetch\?key=site /]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function typeInto(page, selector, text) {
  await page.click(selector)
  await page.keyboard.type(text)
}
// 新版给公告、订阅、路由、权限组的删除加了确认框（有意修正），出现时点「确定」
async function confirmIfAsked(page) {
  await sleep(600)
  const ok = await page.$('.ant-modal-confirm .ant-modal-confirm-btns .ant-btn-primary')
  if (ok) await ok.click()
}
// 打开第 index 行「操作」下拉菜单并点击其中的 itemText（订阅页）
const OPEN_DROPDOWN = '.ant-dropdown:not(.ant-dropdown-hidden):not(#v2board-table-dropdown)'
async function rowAction(page, index, itemText) {
  await clickText(page, FIXED_END_LINK, '操作', index)
  await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, itemText)
}
// 包含 text 的行在主表格中的序号（原版固定列是另一张表格，行里没有这些文字）
async function rowIndexOf(page, text) {
  return page.evaluate((t) => {
    const row = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')].find((r) => r.textContent.includes(t))
    return row ? [...row.parentElement.children].filter((r) => r.classList.contains('ant-table-row')).indexOf(row) : -1
  }, text)
}
// 当前显示的弹窗（关闭过的弹窗会以 display: none 留在 DOM 里）
async function visibleModal(page) {
  for (const wrap of await page.$$('.ant-modal-wrap')) {
    if (await wrap.evaluate((el) => getComputedStyle(el).display !== 'none')) return wrap
  }
  throw new Error('没有打开的弹窗')
}
// 在包含 text 的表格行里点击文字为 linkText 的链接
async function clickRowLink(page, text, linkText) {
  for (const row of await page.$$('.ant-table-tbody tr')) {
    if (!(await row.evaluate((el, t) => el.textContent.includes(t), text))) continue
    for (const a of await row.$$('a')) {
      if ((await a.evaluate((el) => el.textContent.trim())) === linkText) {
        await a.click()
        return
      }
    }
  }
  throw new Error(`没有找到包含「${text}」的行里的「${linkText}」`)
}

const scenarios = {
  dashboard: { route: '/dashboard' },
  'notice-list': { route: '/notice' },
  'notice-toggle': {
    route: '/notice',
    run: async (page) => {
      const switches = await page.$$('.ant-table-tbody .ant-switch')
      await switches[0].click()
      await sleep(1200)
      const again = await page.$$('.ant-table-tbody .ant-switch')
      await again[0].click()
      await sleep(1200)
    },
  },
  'notice-create-drop': {
    route: '/notice',
    run: async (page, target) => {
      await clickText(page, 'button', '添加公告')
      const inputs = await page.$$('.ant-modal-body input.ant-input')
      await inputs[0].click()
      await page.keyboard.type(`请求比对-${target}`)
      await typeInto(page, '.ant-modal-body textarea', '内容 A&B=1')
      await page.click('.ant-modal-body .ant-select')
      await page.keyboard.type('标签1')
      await page.keyboard.press('Enter')
      await inputs[1].click()
      await page.keyboard.type('https://example.com/a.png?x=1')
      await clickText(page, '.ant-modal-footer button', '提 交')
      await sleep(1500)
      // 删除刚创建的那条（标题列包含 target）
      await clickRowLink(page, `请求比对-${target}`, '删除')
      await confirmIfAsked(page)
      await sleep(1500)
    },
  },
  'server-group-list': { route: '/server/group' },
  'server-group-create-edit-drop': {
    route: '/server/group',
    run: async (page, target) => {
      await clickText(page, 'button', '添加权限组')
      await typeInto(page, '.ant-modal-body input.ant-input', `请求比对-${target}`)
      await clickText(page, '.ant-modal-footer button', '提 交')
      await sleep(1500)
      await clickRowLink(page, `请求比对-${target}`, '编辑')
      await sleep(1200)
      const modal = await visibleModal(page)
      await (await modal.$('input.ant-input')).click()
      await page.keyboard.press('End')
      await page.keyboard.type('2')
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
      await clickRowLink(page, `请求比对-${target}2`, '删除')
      await confirmIfAsked(page)
      await sleep(1500)
    },
  },
  'server-route-list': { route: '/server/route' },
  'server-route-create-edit-drop': {
    route: '/server/route',
    run: async (page, target) => {
      await clickText(page, 'button', '添加路由')
      let modal = await visibleModal(page)
      await (await modal.$('input.ant-input')).click()
      await page.keyboard.type(`请求比对-${target}`)
      // 匹配值按行填写，空行在保存时会被过滤
      await (await modal.$('textarea')).click()
      await page.keyboard.type('domain:a.com\n\ndomain:b.com')
      await (await modal.$('.ant-select')).click()
      await sleep(500)
      await clickText(page, SELECT_OPTION, '指定DNS服务器进行解析')
      await sleep(300)
      const inputs = await modal.$$('input.ant-input')
      await inputs.at(-1).click()
      await page.keyboard.type('1.1.1.1')
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
      await clickRowLink(page, `请求比对-${target}`, '编辑')
      await sleep(1200)
      modal = await visibleModal(page)
      await (await modal.$('input.ant-input')).click()
      await page.keyboard.press('End')
      await page.keyboard.type('2')
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
      await clickRowLink(page, `请求比对-${target}2`, '删除')
      await confirmIfAsked(page)
      await sleep(1500)
    },
  },
  'coupon-list': { route: '/coupon' },
  'coupon-toggle': {
    route: '/coupon',
    run: async (page) => {
      for (let i = 0; i < 2; i++) {
        const switches = await page.$$('.ant-table-tbody .ant-switch')
        await switches[0].click()
        await sleep(1500)
      }
    },
  },
  // 已知差异：原版翻页时会带上 antd 3 分页对象的其余字段
  'coupon-page-2': {
    route: '/coupon',
    run: async (page) => {
      await clickText(page, '.ant-pagination-item', '2')
      await sleep(1000)
    },
  },
  'coupon-edit-save': {
    route: '/coupon',
    run: async (page) => {
      // 第二条种子数据：按金额（value 需要 ×100）、限制了周期
      await clickText(page, 'a', '编辑', 1)
      const modal = await visibleModal(page)
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  'coupon-create-invalid': {
    route: '/coupon',
    run: async (page, target) => {
      // 不选有效期：两边都会被后端拒绝（422），只比较提交的内容
      await clickText(page, 'button', '添加优惠券')
      const modal = await visibleModal(page)
      const inputs = await modal.$$('input.ant-input')
      await inputs[0].click()
      await page.keyboard.type(`请求比对-${target}`)
      await (await modal.$('input[type="number"]')).click()
      await page.keyboard.type('10')
      const selects = await modal.$$('.ant-select')
      await selects.at(-2).click()
      await sleep(500)
      await clickText(page, SELECT_OPTION, '体验套餐')
      await sleep(300)
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  'giftcard-list': { route: '/giftcard' },
  'giftcard-edit-save': {
    route: '/giftcard',
    run: async (page) => {
      // 第一条：兑换套餐（plan_id 为数字）；第六条：余额卡（value 需要 ×100）
      for (const nth of [0, 5]) {
        await clickText(page, 'a', '编辑', nth)
        const modal = await visibleModal(page)
        await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
        await sleep(1500)
      }
    },
  },
  'giftcard-create-invalid': {
    route: '/giftcard',
    run: async (page, target) => {
      await clickText(page, 'button', '添加礼品卡')
      const modal = await visibleModal(page)
      await (await modal.$('input.ant-input')).click()
      await page.keyboard.type(`请求比对-${target}`)
      // 类型切到「兑换订阅套餐」，选一个订阅
      await (await modal.$('.ant-input-group-addon .ant-select')).click()
      await sleep(500)
      await clickText(page, SELECT_OPTION, '兑换订阅套餐')
      await sleep(300)
      await (await modal.$('input[type="number"]')).click()
      await page.keyboard.type('30')
      const selects = await modal.$$('.ant-select')
      await selects[1].click()
      await sleep(500)
      await clickText(page, SELECT_OPTION, '基础套餐')
      await sleep(300)
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  'knowledge-list': { route: '/knowledge' },
  'knowledge-toggle': {
    route: '/knowledge',
    run: async (page) => {
      for (let i = 0; i < 2; i++) {
        const switches = await page.$$('.ant-table-tbody .ant-switch')
        await switches[0].click()
        await sleep(1500)
      }
    },
  },
  'knowledge-edit-save': {
    route: '/knowledge',
    run: async (page) => {
      await clickText(page, 'a', '编辑')
      await sleep(1000)
      const drawer = await visibleDrawer(page)
      await (await drawer.$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  'knowledge-create-drop': {
    route: '/knowledge',
    run: async (page, target) => {
      await clickText(page, 'button', '新增')
      const drawer = await visibleDrawer(page)
      const inputs = await drawer.$$('input.ant-input')
      await inputs[0].click()
      await page.keyboard.type(`请求比对-${target}`)
      await inputs[1].click()
      await page.keyboard.type('测试分类')
      await (await drawer.$('.ant-select')).click()
      await sleep(500)
      await clickText(page, SELECT_OPTION, '简体中文')
      await sleep(300)
      await (await drawer.$('.rc-md-editor textarea')).click()
      await page.keyboard.type('## 标题\n正文 A&B')
      await (await drawer.$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(1500)
      await (await drawer.$('.v2board-drawer-action .ant-btn:not(.ant-btn-primary)')).click()
      await sleep(800)
      await clickRowLink(page, `请求比对-${target}`, '删除')
      await confirmIfAsked(page)
      await sleep(1500)
    },
  },
  'knowledge-sort': {
    route: '/knowledge',
    run: async (page) => {
      await dragRow(page, 0, 1)
      await dragRow(page, 1, 0)
    },
  },
  'plan-list': { route: '/plan' },
  'plan-toggle': {
    route: '/plan',
    run: async (page) => {
      // 第一行的销售状态、续费各切换两次（恢复原状）
      for (const column of [0, 1]) {
        for (let i = 0; i < 2; i++) {
          const row = (await page.$$('.ant-table-tbody tr.ant-table-row'))[0]
          await (await row.$$('.ant-switch'))[column].click()
          await sleep(1500)
        }
      }
    },
  },
  'plan-edit-save': {
    route: '/plan',
    run: async (page) => {
      await rowAction(page, 1, '编辑')
      const drawer = await visibleDrawer(page)
      await (await drawer.$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  'plan-create-drop': {
    route: '/plan',
    run: async (page, target) => {
      await clickText(page, 'button', '添加订阅')
      const drawer = await visibleDrawer(page)
      const inputs = await drawer.$$('input.ant-input')
      await inputs[0].click()
      await page.keyboard.type(`请求比对-${target}`)
      // 月付 12.34（×100 四舍五入）、一次性 0.1
      await inputs[1].click()
      await page.keyboard.type('12.34')
      await inputs[7].click()
      await page.keyboard.type('0.1')
      await inputs[9].click()
      await page.keyboard.type('50')
      await (await drawer.$$('.ant-select'))[0].click()
      await sleep(500)
      await clickText(page, SELECT_OPTION, '默认组')
      await sleep(300)
      await (await drawer.$('.ant-checkbox-input')).click()
      await (await drawer.$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(2000)
      await rowAction(page, await rowIndexOf(page, `请求比对-${target}`), '删除')
      await confirmIfAsked(page)
      await sleep(1500)
    },
  },
  'plan-sort': {
    route: '/plan',
    run: async (page) => {
      await dragRow(page, 0, 1)
      await dragRow(page, 1, 0)
    },
  },
  'plan-context-edit': {
    route: '/plan',
    run: async (page) => {
      const rows = await page.$$('.ant-table-tbody tr.ant-table-row')
      const box = await rows[2].boundingBox()
      await page.mouse.click(box.x + 300, box.y + box.height / 2, { button: 'right' })
      await sleep(500)
      await clickText(page, '#v2board-table-dropdown a', '编辑')
      const drawer = await visibleDrawer(page)
      await (await drawer.$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  ...serverManageScenarios,
  ...userScenarios,
  ...orderScenarios,
  ...ticketScenarios,
  ...configScenarios,
  'notice-edit-save': {
    route: '/notice',
    run: async (page) => {
      await clickText(page, 'a', '编辑')
      await clickText(page, '.ant-modal-footer button', '提 交')
      await sleep(1500)
    },
  },
}

// 已知差异：原版翻页时会把 antd 3 分页对象的 size / showSizeChanger / pageSizeOptions 一并带上（后端不使用），新版不发
const ANTD3_PAGINATION_GARBAGE = /&(size|showSizeChanger|pageSizeOptions\[\d+\])=[^&]*/g

function normalize(req) {
  req = { ...req, url: req.url.replace(ANTD3_PAGINATION_GARBAGE, '') }
  const url = new URL(req.url)
  // 新旧版各自创建的测试数据 id、时间戳不同，统一替换
  const body = (req.body ?? '').replace(/(^|&)(id|created_at|updated_at)=\d+/g, '$1$2=<n>')
  // 去掉 origin，只比较路径与查询串（旧版的 Horizon 地址末尾会多一个 ?，新版保持一致）
  return `${req.method} ${url.pathname}${req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''}  [${req.contentType ?? '-'}] ${body}`
}

const token = await login()
const browser = await launch()
const names = args.only ? args.only.split(',') : Object.keys(scenarios)
let failed = 0
const errors = []

for (const name of names) {
  const s = scenarios[name]
  const result = {}
  // before / after：场景前后直接调用管理接口准备或恢复数据（不计入比对）
  const context = s.before ? await s.before(token) : undefined
  for (const target of ['old', 'new']) {
    // between：旧版执行后、新版执行前恢复数据，让两边从同样的状态开始
    if (target === 'new' && s.between) await s.between(token, context)
    const page = await openPage(browser, { token })
    const reqs = []
    page.on('request', (r) => {
      if (!r.url().startsWith(config.apiOrigin) || !/\/(api|monitor)\//.test(r.url()) || r.method() === 'OPTIONS') return
      reqs.push({ method: r.method(), url: r.url(), contentType: r.headers()['content-type'], body: r.postData() })
    })
    if (s.abort) {
      await page.setRequestInterception(true)
      page.on('request', (r) => {
        if (r.method() !== 'OPTIONS' && s.abort.test(r.url())) void r.abort()
        else void r.continue()
      })
    }
    await gotoRoute(page, targets[target](), s.route, { settle: 2000 })
    // 操作出错时记下来继续比对其他场景（例如元素没找到）
    try {
      if (s.run) await s.run(page, target)
    } catch (e) {
      errors.push(`${name}（${target === 'old' ? '旧版' : '新版'}）：${e.message}`)
      if (args.verbose) await page.screenshot({ path: path.join(outRoot, `requests-${name}-${target}.png`) }).catch(() => {})
    }
    await page.close()
    result[target] = reqs.map((r) => normalize(r).replaceAll(`请求比对-${target}`, '请求比对-<target>').replaceAll(encodeURIComponent(`请求比对-${target}`), encodeURIComponent('请求比对-') + '<target>'))
    if (s.normalize) result[target] = result[target].map(s.normalize)
  }
  if (s.after) await s.after(token, context)
  // fixOld：有意修正的场景，把旧版请求改写成修正后的预期再比对（其余部分仍逐字比较）；返回 null 表示修正后不再发出
  if (s.fixOld) result.old = result.old.map(s.fixOld).filter((x) => x !== null)
  const oldSet = result.old.toSorted()
  const newSet = result.new.toSorted()
  const onlyOld = oldSet.filter((x) => !newSet.includes(x))
  const knownNewOnly = [...KNOWN_NEW_ONLY, ...(s.knownNewOnly ?? [])]
  const onlyNew = newSet.filter((x) => !oldSet.includes(x) && !knownNewOnly.some((re) => re.test(x)))
  const ok = !onlyOld.length && !onlyNew.length
  if (!ok) failed++
  console.log(`\n== ${name}：旧 ${oldSet.length} 个请求，新 ${newSet.length} 个请求 ${ok ? '✓ 一致（不计已知差异）' : ''}`)
  if (args.verbose) for (const x of result.old) console.log(`  旧版：${x}`)
  for (const x of onlyOld) console.log(`  仅旧版：${x}`)
  for (const x of onlyNew) console.log(`  仅新版：${x}`)
}
await browser.close()
for (const e of errors) console.log(`\n操作出错：${e}`)
process.exitCode = failed || errors.length ? 1 : 0
