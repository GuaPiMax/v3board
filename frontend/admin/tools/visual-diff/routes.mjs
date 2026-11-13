// 需要截图 / 比对的页面与状态。state 为可选的交互步骤（在页面上打开弹窗等）。
import { clickText, FIXED_END_LINK, SELECT_OPTION } from './actions.mjs'
import { configRoutes } from './routes-config.mjs'
import { serverManageRoutes } from './routes-server.mjs'
import { userRoutes } from './routes-user.mjs'

export { clickText, FIXED_END_LINK, SELECT_OPTION }

// 鼠标停在仪表盘的图表上（提示框）：先把图表滚到视口中间，排行图取纵轴最上面的标签（最大的一项）所在的行，
// 收入图取正中（按图表里的元素定位，新旧版的 SVG 相同）
async function hoverChart(page, id, where) {
  const point = await page.evaluate(
    (chartId, at) => {
      const el = document.getElementById(chartId)
      el.scrollIntoView({ block: 'center' })
      const box = el.getBoundingClientRect()
      if (at === 'center') return [box.x + box.width / 2, box.y + box.height / 2]
      const labels = [...el.querySelectorAll('text')].filter((t) => t.getAttribute('text-anchor') === 'end')
      const top = labels.map((t) => t.getBoundingClientRect()).toSorted((a, b) => a.y - b.y)[0]
      return [box.x + box.width * 0.6, top.y + top.height / 2]
    },
    id,
    where,
  )
  await page.mouse.move(point[0], point[1])
  await new Promise((resolve) => setTimeout(resolve, 800))
}

export const routes = [
  { name: 'login', route: '/login', auth: false },
  { name: 'dashboard', route: '/dashboard', settle: 2500 },
  // 图表的提示框：只截视口（整页截图会临时改变视口尺寸，图表跟着重新布局，提示框会移位）；手机上悬停不出提示框
  {
    name: 'dashboard-rank-tooltip',
    route: '/dashboard',
    settle: 2500,
    desktopOnly: true,
    viewportOnly: true,
    state: (page) => hoverChart(page, 'serverTodayRankChart', 'top'),
  },
  {
    name: 'dashboard-order-tooltip',
    route: '/dashboard',
    settle: 2500,
    desktopOnly: true,
    viewportOnly: true,
    state: (page) => hoverChart(page, 'orderChart', 'center'),
  },
  { name: 'notice', route: '/notice' },
  {
    name: 'notice-modal-create',
    route: '/notice',
    state: async (page) => {
      await clickText(page, 'button', '添加公告')
    },
  },
  {
    name: 'notice-modal-edit',
    route: '/notice',
    state: async (page) => {
      await clickText(page, 'a', '编辑')
    },
  },
  {
    name: 'login-forgot-password',
    route: '/login',
    auth: false,
    state: async (page) => {
      await clickText(page, 'a', '忘记密码')
    },
  },
  {
    name: 'header-user-dropdown',
    route: '/notice',
    state: async (page) => {
      await page.click('#page-header-user-dropdown')
      await new Promise((r) => setTimeout(r, 500))
    },
  },
  // 顶栏的主题按钮（原版没有，只截新版）：收起、展开、悬停在第二项上
  { name: 'header-ui-switch', route: '/notice', uiSwitch: true },
  {
    name: 'header-ui-switch-open',
    route: '/notice',
    uiSwitch: true,
    state: async (page) => {
      await page.click('.v2b-ui-switch > button')
      await new Promise((r) => setTimeout(r, 500))
    },
  },
  {
    name: 'header-ui-switch-hover',
    route: '/notice',
    uiSwitch: true,
    desktopOnly: true,
    state: async (page) => {
      await page.click('.v2b-ui-switch > button')
      await page.hover('.v2b-ui-option:nth-child(2)')
      await new Promise((r) => setTimeout(r, 500))
    },
  },
  {
    name: 'mobile-nav-open',
    route: '/notice',
    mobileOnly: true,
    state: async (page) => {
      await page.click('.sidebar-toggle button')
      await new Promise((r) => setTimeout(r, 800))
    },
  },
  ...configRoutes,
  ...serverManageRoutes,
  { name: 'server-group', route: '/server/group' },
  {
    name: 'server-group-modal-create',
    route: '/server/group',
    state: async (page) => {
      await clickText(page, 'button', '添加权限组')
    },
  },
  {
    name: 'server-group-modal-edit',
    route: '/server/group',
    state: async (page) => {
      await clickText(page, 'a', '编辑')
    },
  },
  { name: 'server-route', route: '/server/route' },
  {
    name: 'server-route-modal-create',
    route: '/server/route',
    state: async (page) => {
      await clickText(page, 'button', '添加路由')
    },
  },
  {
    name: 'server-route-modal-edit',
    route: '/server/route',
    state: async (page) => {
      await clickText(page, 'a', '编辑')
    },
  },
  {
    // 第三条种子数据的动作是 DNS（显示「DNS服务器」输入框）
    name: 'server-route-modal-edit-dns',
    route: '/server/route',
    state: async (page) => {
      await clickText(page, 'a', '编辑', 2)
    },
  },
  {
    // 选择「指定出站服务器」后显示 Xray 出站配置
    name: 'server-route-modal-outbound',
    route: '/server/route',
    state: async (page) => {
      await clickText(page, 'button', '添加路由')
      await page.click('.ant-modal-body .ant-select')
      await new Promise((r) => setTimeout(r, 500))
      await clickText(page, SELECT_OPTION, '指定出站服务器(域名目标)')
    },
  },
  { name: 'plan', route: '/plan' },
  {
    name: 'plan-drawer-create',
    route: '/plan',
    state: async (page) => {
      await clickText(page, 'button', '添加订阅')
    },
  },
  {
    name: 'plan-action-dropdown',
    route: '/plan',
    state: async (page) => {
      await clickText(page, FIXED_END_LINK, '操作')
      await new Promise((r) => setTimeout(r, 400))
    },
  },
  {
    name: 'plan-drawer-edit',
    route: '/plan',
    state: async (page) => {
      await clickText(page, FIXED_END_LINK, '操作')
      await clickText(page, '.ant-dropdown:not(.ant-dropdown-hidden):not(#v2board-table-dropdown) a', '编辑')
    },
  },
  {
    // 右键第二行：在鼠标位置弹出菜单（原版 #v2board-table-dropdown）
    name: 'plan-context-menu',
    route: '/plan',
    state: async (page) => {
      const rows = await page.$$('.ant-table-tbody tr.ant-table-row')
      const box = await rows[1].boundingBox()
      await page.mouse.click(box.x + 300, box.y + box.height / 2, { button: 'right' })
      await new Promise((r) => setTimeout(r, 500))
    },
  },
  { name: 'order', route: '/order', coverageOnly: true },
  { name: 'coupon', route: '/coupon' },
  {
    name: 'coupon-modal-create',
    route: '/coupon',
    state: async (page) => {
      await clickText(page, 'button', '添加优惠券')
    },
  },
  {
    // 第二条种子数据：按金额、限制了周期（多选框里有两个标签）
    name: 'coupon-modal-edit',
    route: '/coupon',
    state: async (page) => {
      await clickText(page, 'a', '编辑', 1)
    },
  },
  {
    name: 'coupon-page-2',
    route: '/coupon',
    state: async (page) => {
      await clickText(page, '.ant-pagination-item', '2')
    },
  },
  { name: 'giftcard', route: '/giftcard' },
  {
    name: 'giftcard-modal-create',
    route: '/giftcard',
    state: async (page) => {
      await clickText(page, 'button', '添加礼品卡')
    },
  },
  {
    // 第一条种子数据是「兑换订阅套餐」：显示「指定订阅」（原版里选择框显示的是订阅 id）
    name: 'giftcard-modal-edit-plan',
    route: '/giftcard',
    state: async (page) => {
      await clickText(page, 'a', '编辑')
    },
  },
  {
    // 第三条是「重置套餐流量」：数值输入框禁用、没有后缀
    name: 'giftcard-modal-edit-reset',
    route: '/giftcard',
    state: async (page) => {
      await clickText(page, 'a', '编辑', 2)
    },
  },
  { name: 'knowledge', route: '/knowledge' },
  {
    name: 'knowledge-drawer-create',
    route: '/knowledge',
    state: async (page) => {
      await clickText(page, 'button', '新增')
    },
  },
  {
    name: 'knowledge-drawer-edit',
    route: '/knowledge',
    state: async (page) => {
      await clickText(page, 'a', '编辑')
      await new Promise((r) => setTimeout(r, 800))
    },
  },
  ...userRoutes,
]
