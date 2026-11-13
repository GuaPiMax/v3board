// M4（用户管理、订单管理、工单管理、队列监控、仪表盘跳转）的请求一致性场景。
// 依赖 v2b-demo 的演示数据（行顺序见 routes-user.mjs）。会真实调用后端，改动的数据在场景结束后恢复：
//   - 编辑用户：场景前记下原始记录，结束后按原值写回（原版保存时会把上下行流量取整到 0.01GB）
//   - 创建 / 批量删除用户：只操作场景里新建的「请求比对-<target>」用户
//   - 订单、工单、工单消息等后台接口无法还原的，用 ../v2b-demo/scripts/sql.sh 直接改库
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { clickText, FIXED_END_LINK, SELECT_OPTION } from './actions.mjs'
import { config, projectRoot } from './lib.mjs'
import { OPEN_DROPDOWN, rightClickRow } from './routes-server.mjs'

const ADMIN_API = `${config.apiOrigin}/api/v1/${config.securePath}`
const DOCKER_DIR = path.resolve(projectRoot, '../v2b-demo')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TOOLBAR = '.v2board-table-action'
const DRAWER = '.ant-drawer-open'
const MODAL = '.ant-modal-wrap:not([style*="display: none"])'

/** 有意修正：订单页第一次请求第 1 页（原版初始分页为 current=0） */
const FIRST_ORDER_PAGE = (req) => req.replace(/(\/order\/fetch\?\S*?\bcurrent=)0(?=&|\s)/, (_, head) => `${head}1`)

/** 在开发环境数据库上执行 SQL（查询返回行数组） */
export function sql(statement) {
  const out = execFileSync(path.join(DOCKER_DIR, 'scripts/sql.sh'), [statement], { cwd: DOCKER_DIR, encoding: 'utf8' })
  return JSON.parse(out.trim().split('\n').at(-1))
}

/** 直接调用管理接口（不经过浏览器，不计入比对） */
export async function api(token, method, route, params = {}) {
  const body = new URLSearchParams()
  // 与前端请求层相同：null 发成空值（后端据此清空字段），undefined 省略
  const add = (key, value) => {
    if (value === undefined) return
    if (value === null) body.append(key, '')
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v)
    else body.append(key, String(value))
  }
  for (const [k, v] of Object.entries(params)) add(k, v)
  const res =
    method === 'GET'
      ? await fetch(`${ADMIN_API}${route}?${body}`, { headers: { authorization: token } })
      : await fetch(`${ADMIN_API}${route}`, {
          method: 'POST',
          headers: { authorization: token, 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
  return res.json().catch(() => ({}))
}

/** 按 id 读取用户原始记录，用于场景结束后写回（邀请人按邮箱写回） */
async function snapshotUser(token, id) {
  const res = await api(token, 'GET', '/user/getUserInfoById', { id })
  const user = res.data
  user.invite_user_email = user.invite_user?.email ?? null
  delete user.invite_user
  return user
}
async function restoreUser(token, user) {
  await api(token, 'POST', '/user/update', { ...user, password: '' })
  // update 不能改的字段（接口只取校验过的字段）直接写库
  sql(`UPDATE v2_user SET t = ${user.t}, updated_at = ${user.updated_at} WHERE id = ${user.id}`)
}

/** 页面里的下载（批量生成、导出 CSV）不保存文件 */
async function denyDownloads(page) {
  const client = await page.createCDPSession()
  await client.send('Browser.setDownloadBehavior', { behavior: 'deny' })
}

/** 打开第 index 行的「操作」菜单并点击其中一项 */
export async function rowMenu(page, index, item) {
  await clickText(page, FIXED_END_LINK, '操作', index)
  await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, item)
}
async function hoverOperations(page) {
  const buttons = await page.$$(`${TOOLBAR} .ant-btn-group .ant-btn`)
  await buttons[1].hover()
  await sleep(600)
}
async function operation(page, item) {
  await hoverOperations(page)
  await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, item)
}
async function confirmOk(page) {
  await sleep(500)
  await (await page.$('.ant-modal-confirm .ant-modal-confirm-btns .ant-btn-primary')).click()
  await sleep(1500)
}
/** 当前抽屉 / 弹窗里标签为 label 的表单项 */
async function field(container, label) {
  for (const group of await container.$$('.form-group')) {
    const text = await group.evaluate((el) => el.querySelector(':scope > label')?.textContent.trim() ?? '')
    if (text.startsWith(label)) return group
  }
  throw new Error(`没有找到表单项「${label}」`)
}
// 抽屉底部的按钮栏会挡住靠下的表单项，操作前先滚到中间
const center = (el) => el.evaluate((node) => node.scrollIntoView({ block: 'center' }))
async function fill(page, container, label, value) {
  const group = await field(container, label)
  await center(group)
  const input = await group.$('input.ant-input, input:not([type]), textarea')
  await input.click()
  await input.evaluate((el) => el.select())
  await page.keyboard.press('Backspace')
  if (value) await page.keyboard.type(value)
}
async function choose(page, container, label, option, nth = 0) {
  const group = await field(container, label)
  await center(group)
  const selects = await group.$$('.ant-select')
  await selects[nth].click()
  await sleep(400)
  await clickText(page, SELECT_OPTION, option)
  await sleep(300)
}
/** 过滤器抽屉：添加一个条件 */
export async function addCondition(page, { field: name, condition, value, option } = {}) {
  await clickText(page, `${DRAWER} button`, '添加条件')
  const drawer = await page.$(DRAWER)
  const groups = (await drawer.$$('.form-group')).slice(-3)
  const pickIn = async (group, text) => {
    // 抽屉底部的按钮栏会挡住靠下的表单项，先滚到中间
    await group.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await (await group.$('.ant-select')).click()
    await sleep(400)
    await clickText(page, SELECT_OPTION, text)
    await sleep(300)
  }
  if (name) await pickIn(groups[0], name)
  if (condition) await pickIn(groups[1], condition)
  if (option) await pickIn(groups[2], option)
  if (value) {
    await (await groups[2].$('input')).click()
    await page.keyboard.type(value)
  }
}
export async function openFilter(page) {
  await clickText(page, `button`, '过滤器')
}
export async function search(page) {
  await clickText(page, `${DRAWER} button`, '检 索')
  await sleep(1500)
}
async function sortById(page) {
  await clickText(page, '.ant-table-thead th', 'ID')
  await sleep(800)
}

/** 点击仪表盘上包含 text 的提示里的「立即处理」 */
export async function clickAlertLink(page, text) {
  const links = await page.$$('.alert a.alert-link')
  for (const link of links) {
    if (await link.evaluate((el, t) => el.closest('.alert').textContent.includes(t), text)) {
      await link.click()
      return
    }
  }
  throw new Error(`仪表盘上没有「${text}」的提示`)
}

export const userScenarios = {
  'user-list': { route: '/user' },
  'user-sort-page': {
    route: '/user',
    run: async (page) => {
      // 升序、降序、取消；然后翻到第 2 页
      for (let i = 0; i < 3; i++) await sortById(page)
      await clickText(page, '.ant-pagination-item', '2')
      await sleep(1200)
    },
  },
  // 「设备数」升序、降序、取消。有意修正：只在前端排序当前页，请求与不排序时相同（原版带 sort=updated_at，
  // 后端按更新时间排序后前端再按在线设备数排序当前页）
  'user-sort-devices': {
    route: '/user',
    fixOld: (req) => req.replace(/sort_type=(ASC|DESC)&sort=updated_at/, 'sort_type=DESC'),
    run: async (page) => {
      for (let i = 0; i < 3; i++) await clickText(page, '.ant-table-thead th', '设备数')
    },
  },
  'user-page-size': {
    route: '/user',
    run: async (page) => {
      await page.click('.ant-pagination-options .ant-select')
      await sleep(500)
      await clickText(page, SELECT_OPTION, '50 条/页')
      await sleep(1500)
      // 恢复（使用习惯里记下的每页条数会影响之后的截图）
      await page.evaluate(() => localStorage.removeItem('habit'))
    },
  },
  'user-filter-reset': {
    route: '/user',
    run: async (page) => {
      await openFilter(page)
      await addCondition(page, { value: 'user21' })
      await search(page)
      await openFilter(page)
      await addCondition(page, { field: '用户ID', condition: '>=', value: '200' })
      await search(page)
      await openFilter(page)
      await clickText(page, `${DRAWER} button`, '重 置')
      await sleep(1500)
    },
  },
  'user-filter-select-date': {
    route: '/user',
    run: async (page) => {
      await openFilter(page)
      await addCondition(page, { field: '订阅', option: '无订阅' })
      await addCondition(page, { field: '账号状态', option: '封禁' })
      await addCondition(page, { field: '管理员', option: '否' })
      await search(page)
    },
  },
  // 过滤器里改了条件没有点「检索」直接取消，再翻页。有意修正：取消后不再带上改过的条件（原版带上 user19）
  'user-filter-cancel': {
    route: '/user',
    fixOld: (req) => req.replace('filter[0][value]=user19&', 'filter[0][value]=user1&'),
    run: async (page) => {
      await openFilter(page)
      await addCondition(page, { value: 'user1' })
      await search(page)
      await openFilter(page)
      const input = await (await page.$(DRAWER)).$('.form-group input.ant-input')
      await input.click()
      await page.keyboard.type('9')
      await clickText(page, `${DRAWER} button`, '取 消')
      await sleep(800)
      await clickText(page, '.ant-pagination-item', '2')
      await sleep(1500)
    },
  },
  'user-invites-orders': {
    route: '/user',
    run: async (page) => {
      await sortById(page)
      await rowMenu(page, 3, 'TA的邀请')
      await sleep(1500)
      await rowMenu(page, 0, 'TA的订单')
      await sleep(2000)
    },
  },
  'user-edit-save': {
    route: '/user',
    before: (token) => snapshotUser(token, 218),
    between: restoreUser,
    after: restoreUser,
    run: async (page) => {
      await rowMenu(page, 2, '编辑')
      await sleep(1000)
      await (await (await page.$(DRAWER)).$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(2000)
    },
  },
  // 有意修正：改动过的流量换算后取整（原版不取整）；没改动的流量、金额按读取时的原值提交（这里的用户数值恰好一致）
  'user-edit-change': {
    route: '/user',
    fixOld: (req) => req.replace(/transfer_enable=(\d+\.\d+)/, (_, v) => `transfer_enable=${Math.round(Number(v))}`),
    before: (token) => snapshotUser(token, 218),
    between: restoreUser,
    after: restoreUser,
    run: async (page) => {
      await rowMenu(page, 2, '编辑')
      await sleep(1000)
      const drawer = await page.$(DRAWER)
      await fill(page, drawer, '邀请人邮箱', 'user011@qq.com')
      await fill(page, drawer, '余额', '12.34')
      await fill(page, drawer, '流量', '123.45')
      await fill(page, drawer, '设备数限制', '5')
      await choose(page, drawer, '订阅计划', '体验套餐')
      await choose(page, drawer, '推荐返利类型', '循环返利')
      await fill(page, drawer, '推荐返利比例', '30')
      await fill(page, drawer, '专享折扣比例', '90')
      await fill(page, drawer, '备注', '请求比对')
      const staff = await field(drawer, '是否员工')
      await center(staff)
      await (await staff.$('.ant-switch')).click()
      await (await drawer.$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(2000)
    },
  },
  // 邮箱格式不对：后端校验失败。注意不能先清空邮箱（原版以邮箱是否为空判断数据是否读取完，清空后表单会变回加载图标）
  'user-edit-invalid': {
    route: '/user',
    before: (token) => snapshotUser(token, 218),
    between: restoreUser,
    after: restoreUser,
    run: async (page) => {
      await rowMenu(page, 2, '编辑')
      await sleep(1000)
      const drawer = await page.$(DRAWER)
      const input = await (await field(drawer, '邮箱')).$('input')
      await input.click()
      await page.keyboard.press('End')
      await page.keyboard.type('@')
      await (await drawer.$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  'user-context-edit': {
    route: '/user',
    before: (token) => snapshotUser(token, 218),
    between: restoreUser,
    after: restoreUser,
    run: async (page) => {
      await rightClickRow(page, 2)
      await clickText(page, '#v2board-table-dropdown a', '编辑')
      await sleep(1000)
      await (await (await page.$(DRAWER)).$('.v2board-drawer-action .ant-btn-primary')).click()
      await sleep(2000)
    },
  },
  'user-create-reset-delete': {
    route: '/user',
    after: () => sql("DELETE FROM v2_user WHERE email LIKE '请求比对-%'"),
    run: async (page, target) => {
      await page.click(`${TOOLBAR} > .ant-btn`)
      await sleep(1200)
      const modal = await page.$(MODAL)
      const inputs = await modal.$$('.ant-input-group input')
      await inputs[0].click()
      await page.keyboard.type(`请求比对-${target}`)
      await inputs[2].click()
      await page.keyboard.type('example.com')
      await (await field(modal, '密码')).$('input').then((el) => el.click())
      await page.keyboard.type('password123')
      await choose(page, modal, '订阅计划', '基础套餐')
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(2000)
      await rowMenu(page, 0, '重置UUID及订阅URL')
      await confirmOk(page)
      await rowMenu(page, 0, '删除用户')
      await confirmOk(page)
    },
  },
  'user-generate-batch': {
    route: '/user',
    between: () => sql("DELETE FROM v2_user WHERE email LIKE '%@请求比对-%'"),
    after: () => sql("DELETE FROM v2_user WHERE email LIKE '%@请求比对-%'"),
    run: async (page, target) => {
      await denyDownloads(page)
      await page.click(`${TOOLBAR} > .ant-btn`)
      await sleep(1200)
      const modal = await page.$(MODAL)
      const inputs = await modal.$$('.ant-modal-body input.ant-input')
      await inputs.at(-1).click()
      await page.keyboard.type('3')
      await sleep(300)
      const suffix = (await modal.$$('.ant-input-group input')).at(-1)
      await suffix.click()
      await page.keyboard.type(`请求比对-${target}.test`)
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(2500)
    },
  },
  // 新旧版各自先建两个测试用户（新版的在旧版执行完后再建，两边的用户总数相同）
  'user-batch-ban-delete': {
    route: '/user',
    before: async (token) => {
      for (const n of ['a', 'b']) await api(token, 'POST', '/user/generate', { email_prefix: `请求比对-old-${n}`, email_suffix: 'example.com' })
    },
    between: async (token) => {
      for (const n of ['a', 'b']) await api(token, 'POST', '/user/generate', { email_prefix: `请求比对-new-${n}`, email_suffix: 'example.com' })
    },
    after: () => sql("DELETE FROM v2_user WHERE email LIKE '请求比对-%'"),
    run: async (page, target) => {
      await openFilter(page)
      await addCondition(page, { value: `请求比对-${target}-` })
      await search(page)
      await operation(page, '批量封禁')
      await confirmOk(page)
      await operation(page, '批量删除')
      await confirmOk(page)
    },
  },
  'user-send-mail': {
    route: '/user',
    run: async (page) => {
      await openFilter(page)
      await addCondition(page, { field: '用户ID', value: '2' })
      await search(page)
      await operation(page, '发送邮件')
      const modal = await page.$(MODAL)
      await fill(page, modal, '主题', '请求比对')
      await fill(page, modal, '发送内容', '内容 A&B=1')
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  // 条件较少时 CSV 不超过后端缓冲区，跨域也能拿到文件
  'user-dump-csv-small': {
    route: '/user',
    run: async (page) => {
      await denyDownloads(page)
      await openFilter(page)
      await addCondition(page, { value: 'user00' })
      await search(page)
      await operation(page, '导出CSV')
      await sleep(2000)
    },
  },
  // 全部用户的 CSV 超过后端缓冲区：原版跨域拿不到文件（只有一个失败的请求）；
  // 有意修正：新版改为分页读取列表在前端生成（多出按 id 升序读取的列表请求）
  'user-dump-csv-fallback': {
    route: '/user',
    knownNewOnly: [/user\/fetch\?pageSize=500&current=\d+&sort_type=ASC&sort=id /],
    run: async (page) => {
      await denyDownloads(page)
      await operation(page, '导出CSV')
      await sleep(3000)
    },
  },
  'user-traffic': {
    route: '/user',
    run: async (page) => {
      await sortById(page)
      await rowMenu(page, 1, 'TA的流量记录')
      await sleep(1200)
      await clickText(page, `${MODAL} .ant-pagination-item`, '2')
      await sleep(1200)
      await clickText(page, `${MODAL} .ant-pagination-item`, '3')
      await sleep(1200)
      // 关闭后再打开：按上次的页码重新读取
      await (await page.$(`${MODAL} .ant-modal-close`)).click()
      await sleep(800)
      await rowMenu(page, 1, 'TA的流量记录')
      await sleep(1200)
    },
  },
  'user-assign-error': {
    route: '/user',
    run: async (page) => {
      await rowMenu(page, 2, '分配订单')
      const modal = await page.$(MODAL)
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1200)
      await fill(page, modal, '用户邮箱', 'nobody@example.com')
      await choose(page, modal, '请选择订阅', '基础套餐')
      await choose(page, modal, '请选择周期', '季付')
      await fill(page, modal, '支付金额', '19.99')
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
}

// 订单：第 5 行是已完成、有邀请人的订单（id 2，佣金已驳回），第 9 行待支付（id 79）
export const orderScenarios = {
  'order-list': { route: '/order', fixOld: FIRST_ORDER_PAGE },
  'order-page-filter': {
    route: '/order',
    fixOld: FIRST_ORDER_PAGE,
    run: async (page) => {
      await clickText(page, '.ant-pagination-item', '2')
      await sleep(1200)
      await openFilter(page)
      await addCondition(page, { field: '订单状态', option: '已完成' })
      await addCondition(page, { field: '佣金金额', condition: '>', value: '0' })
      await search(page)
    },
  },
  'order-detail-jump': {
    route: '/order',
    fixOld: FIRST_ORDER_PAGE,
    run: async (page) => {
      const links = await page.$$('.ant-table-tbody tr.ant-table-row td:first-child a')
      await links[5].click()
      await sleep(2000)
      await (await page.$(`${MODAL} .ant-col-18 a`)).click()
      await sleep(2000)
    },
  },
  'order-detail-invite-jump': {
    route: '/order',
    fixOld: FIRST_ORDER_PAGE,
    run: async (page) => {
      const links = await page.$$('.ant-table-tbody tr.ant-table-row td:first-child a')
      await links[5].click()
      await sleep(2000)
      const inviteLinks = await page.$$(`${MODAL} .ant-col-18 a`)
      await inviteLinks.at(-1).click()
      await sleep(2000)
    },
  },
  'order-commission-update': {
    route: '/order',
    fixOld: FIRST_ORDER_PAGE,
    after: () => sql('UPDATE v2_order SET commission_status = 3 WHERE id = 2'),
    run: async (page) => {
      for (const item of ['待确认', '无效']) {
        const rows = await page.$$('.ant-table-tbody tr.ant-table-row')
        await (await rows[5].$('td:nth-child(8) a')).click()
        await sleep(600)
        await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, item)
        await sleep(1500)
      }
    },
  },
  // 待支付订单「标记为 → 取消」：用第 6 行已取消的订单（id 73），新旧版执行前都先改回待支付，结束后恢复
  'order-cancel': {
    route: '/order',
    fixOld: FIRST_ORDER_PAGE,
    before: () => sql('UPDATE v2_order SET status = 0 WHERE id = 73'),
    between: () => sql('UPDATE v2_order SET status = 0 WHERE id = 73'),
    after: () => sql('UPDATE v2_order SET status = 2 WHERE id = 73'),
    run: async (page) => {
      const rows = await page.$$('.ant-table-tbody tr.ant-table-row')
      await (await rows[6].$('td:nth-child(6) a')).click()
      await sleep(600)
      await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, '取消')
      await sleep(1500)
    },
  },
  'order-assign-error': {
    route: '/order',
    fixOld: FIRST_ORDER_PAGE,
    run: async (page) => {
      await clickText(page, 'button', '添加订单')
      const modal = await page.$(MODAL)
      await fill(page, modal, '用户邮箱', 'nobody@example.com')
      await choose(page, modal, '请选择订阅', '体验套餐')
      await choose(page, modal, '请选择周期', '月付')
      await fill(page, modal, '支付金额', '0.1')
      await (await modal.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  // 仪表盘「立即处理」：待确认佣金 → 带三个条件跳到订单管理；待处理工单 → 工单管理。
  // 有意修正：设置好条件再跳转，由订单页请求一次（原版每追加一个条件请求一次订单列表，跳过去后再请求一次）
  'dashboard-commission-jump': {
    route: '/dashboard',
    fixOld: (req) => (req.includes('/order/fetch?') && !req.includes('filter[2]') ? null : req),
    run: async (page) => {
      await clickAlertLink(page, '佣金')
      await sleep(2000)
    },
  },
  'dashboard-ticket-jump': {
    route: '/dashboard',
    run: async (page) => {
      await clickAlertLink(page, '工单')
      await sleep(2000)
    },
  },
}

export const ticketScenarios = {
  'ticket-list': { route: '/ticket' },
  'ticket-tabs-filter-search': {
    route: '/ticket',
    run: async (page) => {
      await clickText(page, '.ant-radio-button-wrapper', '已关闭')
      await sleep(1200)
      await clickText(page, '.ant-radio-button-wrapper', '已开启')
      await sleep(1200)
      await page.click('.ant-table-thead .anticon-filter')
      await sleep(600)
      await clickText(page, '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', '已回复')
      await clickText(page, '.ant-table-filter-dropdown-link', '确定')
      await sleep(1200)
      await page.click('.p-3 input[placeholder="输入邮箱搜索"]')
      await page.keyboard.type('user011@qq.com')
      await sleep(1500)
      await page.click('.ant-table-thead .anticon-filter')
      await sleep(600)
      await clickText(page, '.ant-table-filter-dropdown-link', '重置')
      await sleep(1500)
    },
  },
  'ticket-close': {
    route: '/ticket',
    between: () => sql('UPDATE v2_ticket SET status = 0 WHERE id = 5'),
    after: () => sql('UPDATE v2_ticket SET status = 0 WHERE id = 5'),
    run: async (page) => {
      await clickText(page, FIXED_END_LINK, '关闭', 0)
      await sleep(1500)
    },
  },
  // 工单对话：进入时读取工单、订阅与用户，之后每 5 秒读取一次工单
  'ticket-chat-poll': {
    route: '/ticket/5',
    run: async () => {
      await sleep(5500)
    },
  },
  'ticket-chat-reply': {
    route: '/ticket/5',
    after: () => {
      sql("DELETE FROM v2_ticket_message WHERE message LIKE '请求比对%'")
      sql('UPDATE v2_ticket SET reply_status = 1 WHERE id = 5')
    },
    run: async (page) => {
      await page.click('.js-chat-input')
      await page.keyboard.type('请求比对')
      await page.keyboard.press('Enter')
      await sleep(1500)
    },
  },
  'ticket-chat-user-traffic': {
    route: '/ticket/5',
    run: async (page) => {
      await page.click('.anticon-user')
      await sleep(1500)
      await page.mouse.click(40, 400)
      await sleep(800)
      await page.click('.anticon-solution')
      await sleep(1500)
    },
  },
  'queue-poll': {
    route: '/queue',
    run: async () => {
      await sleep(3500)
    },
  },
}
