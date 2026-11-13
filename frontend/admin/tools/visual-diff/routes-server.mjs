// 节点管理（/server/manage）的截图状态。
// 依赖 v2b-demo 的演示节点与节点在线模拟（./scripts/simulate-nodes.sh --hold=86400），行顺序按 sort：
//   ss、ss 子节点、vmess、trojan、vless(Reality)、hysteria2、tuic、anytls、v2node(vless + Reality)
import { clickText, FIXED_END_LINK } from './actions.mjs'

const ROUTE = '/server/manage'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const NODE_ROWS = {
  shadowsocks: 0,
  'shadowsocks-child': 1,
  vmess: 2,
  trojan: 3,
  vless: 4,
  hysteria: 5,
  tuic: 6,
  anytls: 7,
  v2node: 8,
}
// 新建菜单（工具栏「+」）里各协议的文字
export const CREATE_LABELS = {
  v2node: 'V2node',
  shadowsocks: 'Shadowsocks',
  vmess: 'VMess',
  trojan: 'Trojan',
  hysteria: 'Hysteria',
  tuic: 'Tuic',
  vless: 'VLess',
  anytls: 'AnyTLS',
}
export const OPEN_DROPDOWN = '.ant-dropdown:not(.ant-dropdown-hidden):not(#v2board-table-dropdown)'
// 打开的抽屉里的链接（嵌套抽屉打开时取最上层）
const DRAWER_LINK = '.ant-drawer-open .ant-drawer-body a'
// 行里的「操作」链接：桌面端在表格固定列里，移动端在列表项右侧
export const ROW_ACTION_LINK = `${FIXED_END_LINK}, .v2board_node_mobile .ant-list-item-extra a`

/** 悬停工具栏的「+」，打开新建菜单 */
export async function hoverCreate(page) {
  await page.hover('.v2board-table-action .ant-dropdown-trigger')
  await sleep(600)
}
/** 新建某种协议的节点（打开新建抽屉） */
export async function openCreate(page, type) {
  await hoverCreate(page)
  await clickText(page, `${OPEN_DROPDOWN} .ant-tag`, CREATE_LABELS[type])
}
/** 打开某行「操作」菜单里的「编辑」 */
export async function openEdit(page, type) {
  await clickText(page, ROW_ACTION_LINK, '操作', NODE_ROWS[type])
  await clickText(page, `${OPEN_DROPDOWN} a`, '编辑')
}
/** 在当前抽屉里点击链接（如「编辑配置」），打开子抽屉 */
export async function openChild(page, text, nth = 0) {
  await clickText(page, DRAWER_LINK, text, nth)
}
/** 右键第 index 行 */
export async function rightClickRow(page, index) {
  const rows = await page.$$('.ant-table-tbody tr.ant-table-row')
  const box = await rows[index].boundingBox()
  await page.mouse.click(box.x + 300, box.y + box.height / 2, { button: 'right' })
  await sleep(500)
}

const drawerStates = [
  ...Object.keys(CREATE_LABELS).map((type) => ({
    name: `server-manage-drawer-create-${type}`,
    route: ROUTE,
    state: (page) => openCreate(page, type),
  })),
  ...Object.keys(CREATE_LABELS).map((type) => ({
    name: `server-manage-drawer-edit-${type}`,
    route: ROUTE,
    state: (page) => openEdit(page, type),
  })),
  {
    name: 'server-manage-drawer-edit-shadowsocks-child',
    route: ROUTE,
    state: (page) => openEdit(page, 'shadowsocks-child'),
  },
]

// 子抽屉（安全性 / 传输协议 / 加密 / 填充方案）
const childStates = [
  {
    name: 'server-manage-child-vmess-tls',
    state: async (page) => {
      await openEdit(page, 'vmess')
      await openChild(page, '编辑配置', 0)
    },
  },
  {
    name: 'server-manage-child-vmess-network',
    state: async (page) => {
      await openEdit(page, 'vmess')
      await openChild(page, '编辑配置', 1)
    },
  },
  {
    name: 'server-manage-child-trojan-network',
    state: async (page) => {
      await openEdit(page, 'trojan')
      await openChild(page, '编辑配置', 0)
    },
  },
  {
    name: 'server-manage-child-vless-reality',
    state: async (page) => {
      await openEdit(page, 'vless')
      await openChild(page, '编辑配置', 0)
    },
  },
  {
    name: 'server-manage-child-vless-network',
    state: async (page) => {
      await openEdit(page, 'vless')
      await openChild(page, '编辑配置', 1)
    },
  },
  {
    name: 'server-manage-child-anytls-padding',
    state: async (page) => {
      await openEdit(page, 'anytls')
      await openChild(page, '编辑填充方案')
    },
  },
  {
    name: 'server-manage-child-v2node-reality',
    state: async (page) => {
      await openEdit(page, 'v2node')
      await openChild(page, '编辑配置', 0)
    },
  },
  {
    name: 'server-manage-child-v2node-network',
    state: async (page) => {
      await openEdit(page, 'v2node')
      await openChild(page, '编辑配置', 1)
    },
  },
].map((s) => ({ route: ROUTE, ...s }))

export const serverManageRoutes = [
  { name: 'server-manage', route: ROUTE },
  { name: 'server-manage-create-dropdown', route: ROUTE, state: hoverCreate },
  {
    name: 'server-manage-action-dropdown',
    route: ROUTE,
    state: async (page) => {
      await clickText(page, ROW_ACTION_LINK, '操作')
      await sleep(400)
    },
  },
  { name: 'server-manage-context-menu', route: ROUTE, desktopOnly: true, state: (page) => rightClickRow(page, 1) },
  {
    // 移动端没有排序按钮
    name: 'server-manage-sort-mode',
    route: ROUTE,
    desktopOnly: true,
    state: async (page) => {
      await clickText(page, 'button', '编辑排序')
    },
  },
  {
    name: 'server-manage-search',
    route: ROUTE,
    state: async (page) => {
      await page.click('.v2board-table-action input')
      await page.keyboard.type('香港')
      await sleep(600)
    },
  },
  {
    // 「节点ID」列的协议筛选
    name: 'server-manage-filter-type',
    route: ROUTE,
    desktopOnly: true,
    state: async (page) => {
      await page.click('.ant-table-thead th:first-child .anticon-filter, .ant-table-thead th:first-child .ant-table-filter-trigger')
      await sleep(600)
    },
  },
  {
    // 「权限组」列的筛选：先把表格横向滚到最右，筛选图标才不被固定列遮住
    name: 'server-manage-filter-group',
    route: ROUTE,
    desktopOnly: true,
    state: async (page) => {
      await page.evaluate(() => {
        const el = document.querySelector('.ant-table-scroll .ant-table-body, .ant-table-content')
        el.scrollLeft = el.scrollWidth
      })
      await sleep(400)
      const th = await page.evaluateHandle(() =>
        [...document.querySelectorAll('.ant-table-thead th')].find((t) => t.textContent.includes('权限组')),
      )
      await (await th.asElement().$('.anticon-filter, .ant-table-filter-trigger')).click()
      await sleep(600)
    },
  },
  {
    // 按协议筛选（Vmess、Trojan）后的列表，筛选图标变为主题色
    name: 'server-manage-filtered',
    route: ROUTE,
    desktopOnly: true,
    state: async (page) => {
      await page.click('.ant-table-thead th:first-child .anticon-filter, .ant-table-thead th:first-child .ant-table-filter-trigger')
      await sleep(600)
      await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, 'Vmess')
      await clickText(page, `${OPEN_DROPDOWN} .ant-dropdown-menu-item`, 'Trojan')
      await clickText(page, `${OPEN_DROPDOWN} a`, '确定')
      await page.mouse.move(700, 800)
      await sleep(400)
    },
  },
  {
    // 「节点」列标题的状态说明（三个状态点 + 文字）
    name: 'server-manage-status-tooltip',
    route: ROUTE,
    desktopOnly: true,
    state: async (page) => {
      const th = await page.evaluateHandle(() =>
        [...document.querySelectorAll('.ant-table-thead th')].find((t) => t.textContent.trim() === '节点'),
      )
      await (await th.asElement().$('.anticon-question-circle')).hover()
      await sleep(800)
    },
  },
  {
    // 点击地址复制，顶部提示「复制成功」
    name: 'server-manage-copy-host',
    route: ROUTE,
    desktopOnly: true,
    state: async (page) => {
      await clickText(page, '.ant-table-tbody td span', 'jp01.example.com:443')
      await page.mouse.move(700, 850)
      await sleep(300)
    },
  },
  {
    // 保存失败（名称为空）：右上角「请求失败」通知（所有接口报错共用）。不会修改数据
    name: 'server-manage-save-error',
    route: ROUTE,
    state: async (page) => {
      await openEdit(page, 'vmess')
      const drawers = await page.$$('.ant-drawer.ant-drawer-open')
      const input = await drawers.at(-1).$('input.ant-input')
      await input.click()
      await input.evaluate((el) => el.select())
      await page.keyboard.press('Backspace')
      await (await drawers.at(-1).$('.v2board-drawer-action .ant-btn-primary')).click()
      await page.mouse.move(400, 850)
      await sleep(1000)
    },
  },
  ...drawerStates,
  ...childStates,
]
