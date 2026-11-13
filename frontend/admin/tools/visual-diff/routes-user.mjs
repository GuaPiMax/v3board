// M4：用户管理、订单管理、工单管理、队列监控的截图状态（依赖 v2b-demo 的演示数据）。
//   用户列表按加入时间倒序：第 0 行是管理员，第 2 行（id 218）有订阅，第 6 行（id 203）有邀请人；
//   按 ID 升序后第 1 行是 id 2（有 7 天流量记录），第 3 行是 id 4（邀请了 2 个用户）
//   订单列表第 5 行（id 2）已完成且有邀请人（佣金已驳回），第 9 行（id 79）待支付
import { clickText, FIXED_END_LINK, SELECT_OPTION } from './actions.mjs'
import { OPEN_DROPDOWN, rightClickRow } from './routes-server.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const TOOLBAR = '.v2board-table-action'
// 打开的抽屉 / 弹窗
const DRAWER = '.ant-drawer-open'

/** 打开第 index 行的「操作」菜单，可选再点其中一项 */
async function rowMenu(page, index, item) {
  await clickText(page, FIXED_END_LINK, '操作', index)
  if (item) await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, item)
}
/**
 * 订单列表里第一个在第 column 列有链接的行（订单状态的「标记为」只在待支付的订单上，佣金的「标记为」只在有佣金的订单上）；
 * 当前页没有就往后翻页（演示数据变了以后，这类订单不一定在第一页）。withLink 为 false 时找第一个没有链接的行
 */
async function findOrderRow(page, column, withLink = true) {
  for (let i = 0; i < 5; i++) {
    for (const row of await page.$$('.ant-table-tbody tr.ant-table-row')) {
      if (Boolean(await row.$(`td:nth-child(${column}) a`)) === withLink) return row
    }
    const next = await page.$('.ant-pagination-next:not(.ant-pagination-disabled)')
    if (!next) break
    await next.click()
    await sleep(1500)
  }
  throw new Error(`订单列表前 5 页里没有第 ${column} 列${withLink ? '带' : '不带'}链接的行`)
}
/** 按 ID 升序（点一次 ID 列的排序） */
async function sortById(page) {
  await clickText(page, '.ant-table-thead th', 'ID')
}
/** 悬停工具栏的「操作」按钮 */
async function hoverOperations(page) {
  const buttons = await page.$$(`${TOOLBAR} .ant-btn-group .ant-btn`)
  await buttons[1].hover()
  // 手机上偶尔 600ms 后菜单还没展开（插画的手机基准曾截到没有菜单的一帧），先等菜单出现
  await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden)', { visible: true, timeout: 3000 }).catch(() => undefined)
  await sleep(600)
}
/**
 * 打开过滤器抽屉。手机上 Tips 提示会一直盖在抽屉上方（原版在左、新版在右），挡住「添加条件」，
 * 这里在手机上把提示隐藏掉再操作（新旧版同样处理，只比对抽屉本身）
 */
async function openFilter(page) {
  await clickText(page, `${TOOLBAR} button`, '过滤器')
  if (page.viewport().width < 768) await page.addStyleTag({ content: '.ant-tooltip { display: none !important; }' })
}
async function clickAddCondition(page) {
  await clickText(page, `${DRAWER} button`, '添加条件')
}
/** 过滤器抽屉：添加一个条件（选择字段名、条件，填写内容） */
async function addCondition(page, { field, condition, value } = {}) {
  await clickAddCondition(page)
  const drawer = await page.$(DRAWER)
  const groups = await drawer.$$('.form-group')
  const [fieldGroup, conditionGroup, valueGroup] = groups.slice(-3)
  if (field) {
    await (await fieldGroup.$('.ant-select')).click()
    await sleep(400)
    await clickText(page, SELECT_OPTION, field)
  }
  if (condition) {
    await (await conditionGroup.$('.ant-select')).click()
    await sleep(400)
    await clickText(page, SELECT_OPTION, condition)
  }
  if (value) {
    await (await valueGroup.$('input')).click()
    await page.keyboard.type(value)
  }
}

const USER = '/user'
const userStates = [
  { name: 'user', route: USER },
  {
    name: 'user-tips-tooltip',
    route: USER,
    state: async (page) => {
      await page.hover(`${TOOLBAR} .ant-btn-group`)
      await sleep(800)
    },
  },
  { name: 'user-operations-menu', route: USER, state: hoverOperations },
  {
    name: 'user-filter-drawer',
    route: USER,
    state: (page) => openFilter(page),
  },
  {
    name: 'user-filter-condition',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page)
    },
  },
  {
    name: 'user-filter-field-options',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page)
      await (await page.$(`${DRAWER} .ant-select`)).click()
      await sleep(600)
    },
  },
  {
    name: 'user-filter-select-value',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page, { field: '账号状态' })
      const selects = await (await page.$(DRAWER)).$$('.ant-select')
      await selects.at(-1).click()
      await sleep(600)
    },
  },
  {
    name: 'user-filter-date-value',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page, { field: '到期时间', condition: '<' })
    },
  },
  {
    // 提示只显示 1.5 秒：点击后等入场动画结束就截图（clickText 点击后会等 1.2 秒，这里直接点）
    name: 'user-filter-empty-value',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page)
      const buttons = await (await page.$(DRAWER)).$$('.v2board-drawer-action button')
      await buttons.at(-1).click()
      await sleep(700)
    },
  },
  {
    name: 'user-filter-applied',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page, { value: 'user21' })
      await clickText(page, `${DRAWER} button`, '检 索')
      await sleep(800)
    },
  },
  {
    name: 'user-filter-applied-operations',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page, { value: 'user21' })
      await clickText(page, `${DRAWER} button`, '检 索')
      await sleep(800)
      await hoverOperations(page)
    },
  },
  {
    name: 'user-filter-reopen',
    route: USER,
    state: async (page) => {
      await openFilter(page)
      await addCondition(page, { value: 'user21' })
      await clickText(page, `${DRAWER} button`, '检 索')
      await sleep(800)
      await openFilter(page)
    },
  },
  { name: 'user-row-menu', route: USER, state: (page) => rowMenu(page, 2) },
  {
    name: 'user-drawer-edit',
    route: USER,
    state: async (page) => {
      await rowMenu(page, 2, '编辑')
      await sleep(600)
    },
  },
  {
    name: 'user-drawer-edit-invite',
    route: USER,
    state: async (page) => {
      await rowMenu(page, 6, '编辑')
      await sleep(600)
    },
  },
  {
    name: 'user-drawer-edit-plan-options',
    route: USER,
    state: async (page) => {
      await rowMenu(page, 2, '编辑')
      await sleep(600)
      const groups = await (await page.$(DRAWER)).$$('.form-group')
      for (const group of groups) {
        if ((await group.evaluate((el) => el.querySelector('label')?.textContent)) === '订阅计划') {
          await (await group.$('.ant-select')).click()
          break
        }
      }
      await sleep(600)
    },
  },
  { name: 'user-assign-modal', route: USER, state: (page) => rowMenu(page, 2, '分配订单') },
  { name: 'user-reset-confirm', route: USER, state: (page) => rowMenu(page, 2, '重置UUID及订阅URL') },
  { name: 'user-delete-confirm', route: USER, state: (page) => rowMenu(page, 2, '删除用户') },
  {
    name: 'user-copy-message',
    route: USER,
    state: async (page) => {
      await rowMenu(page, 2, '复制订阅URL')
      await sleep(200)
    },
  },
  {
    name: 'user-traffic-modal',
    route: USER,
    state: async (page) => {
      await sortById(page)
      await rowMenu(page, 1, 'TA的流量记录')
      await sleep(600)
    },
  },
  {
    name: 'user-invites',
    route: USER,
    state: async (page) => {
      await sortById(page)
      await rowMenu(page, 3, 'TA的邀请')
      await sleep(800)
    },
  },
  { name: 'user-sort-id', route: USER, state: sortById },
  {
    name: 'user-page-2',
    route: USER,
    state: (page) => clickText(page, '.ant-pagination-item', '2'),
  },
  {
    // 窄屏下 antd 3 / antd 6 都不显示每页条数选择
    name: 'user-size-changer',
    route: USER,
    desktopOnly: true,
    state: async (page) => {
      await page.click('.ant-pagination-options .ant-select')
      await sleep(600)
    },
  },
  {
    name: 'user-email-tooltip',
    route: USER,
    state: async (page) => {
      const cells = await page.$$('.ant-table-tbody tr.ant-table-row td:nth-child(2) > span')
      await cells[2].hover()
      await sleep(800)
    },
  },
  {
    name: 'user-create-modal',
    route: USER,
    state: async (page) => {
      await page.click(`${TOOLBAR} > .ant-btn`)
      await sleep(1200)
    },
  },
  {
    name: 'user-create-modal-batch',
    route: USER,
    state: async (page) => {
      await page.click(`${TOOLBAR} > .ant-btn`)
      await sleep(1200)
      const inputs = await page.$$('.ant-modal-wrap:not([style*="display: none"]) .ant-modal-body input.ant-input')
      await inputs.at(-1).click()
      await page.keyboard.type('20')
      await sleep(300)
    },
  },
  {
    // 手机上原版的 Tips 提示盖住「操作」按钮，悬停打不开操作菜单
    name: 'user-send-mail-modal',
    route: USER,
    desktopOnly: true,
    state: async (page) => {
      await hoverOperations(page)
      await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, '发送邮件')
    },
  },
  { name: 'user-context-menu', route: USER, desktopOnly: true, state: (page) => rightClickRow(page, 2) },
]

const ORDER = '/order'
const orderStates = [
  { name: 'order', route: ORDER },
  {
    // 有佣金的订单：详情里有邀请人、佣金一节
    name: 'order-detail-modal',
    route: ORDER,
    state: async (page) => {
      const row = await findOrderRow(page, 8)
      await (await row.$('td:first-child a')).click()
      await sleep(1500)
      // 移动一下鼠标：antd 6 表格的行悬停由脚本维护，弹窗盖住后要等鼠标移动才清除
      await page.mouse.move(20, 20)
      await sleep(200)
    },
  },
  {
    // 没有佣金的订单
    name: 'order-detail-modal-plain',
    route: ORDER,
    state: async (page) => {
      const row = await findOrderRow(page, 8, false)
      await (await row.$('td:first-child a')).click()
      await sleep(1500)
      // 移动一下鼠标：antd 6 表格的行悬停由脚本维护，弹窗盖住后要等鼠标移动才清除
      await page.mouse.move(20, 20)
      await sleep(200)
    },
  },
  {
    // 待支付订单的「标记为」
    name: 'order-status-menu',
    route: ORDER,
    state: async (page) => {
      const row = await findOrderRow(page, 6)
      await (await row.$('td:nth-child(6) a')).click()
      await sleep(800)
    },
  },
  {
    // 佣金的「标记为」
    name: 'order-commission-menu',
    route: ORDER,
    state: async (page) => {
      const row = await findOrderRow(page, 8)
      await (await row.$('td:nth-child(8) a')).click()
      await sleep(800)
    },
  },
  {
    name: 'order-status-tooltip',
    route: ORDER,
    state: async (page) => {
      const th = await page.$$('.ant-table-thead th')
      await (await th[5].$('span span')).hover()
      await sleep(800)
    },
  },
  {
    name: 'order-filter-drawer',
    route: ORDER,
    state: async (page) => {
      await clickText(page, 'button', '过滤器')
      await addCondition(page, { field: '订单状态' })
    },
  },
  { name: 'order-assign-modal', route: ORDER, state: (page) => clickText(page, 'button', '添加订单') },
  {
    name: 'order-assign-period-options',
    route: ORDER,
    state: async (page) => {
      await clickText(page, 'button', '添加订单')
      const selects = await page.$$('.ant-modal-wrap:not([style*="display: none"]) .ant-select')
      await selects[1].click()
      await sleep(600)
    },
  },
  { name: 'order-page-2', route: ORDER, state: (page) => clickText(page, '.ant-pagination-item', '2') },
  {
    name: 'order-from-user',
    route: USER,
    state: async (page) => {
      await rowMenu(page, 2, 'TA的订单')
      await sleep(1200)
    },
  },
]

const TICKET = '/ticket'
const ticketStates = [
  { name: 'ticket', route: TICKET },
  {
    name: 'ticket-closed',
    route: TICKET,
    state: async (page) => {
      await clickText(page, '.ant-radio-button-wrapper', '已关闭')
      await sleep(600)
    },
  },
  {
    name: 'ticket-filter-dropdown',
    route: TICKET,
    state: async (page) => {
      await page.click('.ant-table-thead .anticon-filter')
      await sleep(600)
    },
  },
  {
    name: 'ticket-filter-replied',
    route: TICKET,
    state: async (page) => {
      await page.click('.ant-table-thead .anticon-filter')
      await sleep(600)
      await clickText(page, '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', '已回复')
      await clickText(page, '.ant-table-filter-dropdown-link', '确定')
      await sleep(600)
    },
  },
  {
    name: 'ticket-search',
    route: TICKET,
    state: async (page) => {
      await page.click('.p-3 input[placeholder="输入邮箱搜索"]')
      await page.keyboard.type('user011@qq.com')
      await sleep(1200)
    },
  },
  { name: 'ticket-chat', route: '/ticket/5', settle: 2000 },
  { name: 'ticket-chat-closed', route: '/ticket/4', settle: 2000 },
  {
    name: 'ticket-chat-tooltip',
    route: '/ticket/5',
    settle: 2000,
    state: async (page) => {
      await page.hover('.anticon-user')
      await sleep(800)
    },
  },
  {
    name: 'ticket-chat-user-drawer',
    route: '/ticket/5',
    settle: 2000,
    state: async (page) => {
      await page.click('.anticon-user')
      await sleep(1500)
    },
  },
  {
    name: 'ticket-chat-traffic',
    route: '/ticket/5',
    settle: 2000,
    state: async (page) => {
      await page.click('.anticon-solution')
      await sleep(1500)
    },
  },
]

export const userRoutes = [
  ...userStates,
  ...orderStates,
  ...ticketStates,
  { name: 'queue', route: '/queue', settle: 2000 },
]
