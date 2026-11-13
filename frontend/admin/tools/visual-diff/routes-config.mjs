// M5：系统配置、支付配置、主题配置的截图状态。
// 显示子项（开启某项后才出现的设置）的状态需要先改后端配置：setup / teardown 通过管理接口修改并恢复（见 capture.mjs）。
import { clickText, FIXED_END_LINK, SELECT_OPTION } from './actions.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SYSTEM = '/config/system'
const PAYMENT = '/config/payment'
const THEME = '/config/theme'

/** 切换系统配置的标签页（手机上标签栏放不下，点 DOM 元素，由组件自己把选中的标签滚动到可见） */
export async function openTab(page, label) {
  const tab = await page.waitForFunction(
    (t) => [...document.querySelectorAll('.ant-tabs-tab')].find((el) => el.textContent.trim() === t),
    { timeout: 10000 },
    label,
  )
  await tab.evaluate((el) => (el.querySelector('.ant-tabs-tab-btn') ?? el).click())
  await sleep(800)
}

const TABS = [
  ['safe', '安全'],
  ['subscribe', '订阅'],
  ['deposit', '充值'],
  ['ticket', '工单'],
  ['invite', '邀请&佣金'],
  ['frontend', '个性化'],
  ['server', '节点'],
  ['email', '邮件'],
  ['telegram', 'Telegram'],
  ['app', 'APP'],
]

// 打开各分组的子项（演示环境默认都关闭；防爆破限制默认开启）
const CHILDREN_ON = {
  try_out_plan_id: 1,
  email_whitelist_enable: 1,
  recaptcha_enable: 1,
  register_limit_by_ip_enable: 1,
  show_subscribe_method: 2,
  commission_distribution_enable: 1,
  telegram_bot_token: '123456:visual-diff',
}
const CHILDREN_OFF = {
  try_out_plan_id: 0,
  email_whitelist_enable: 0,
  recaptcha_enable: 0,
  register_limit_by_ip_enable: 0,
  show_subscribe_method: 0,
  commission_distribution_enable: 0,
  telegram_bot_token: '',
}
const withChildren = {
  setup: (api) => api.saveConfig(CHILDREN_ON),
  teardown: (api) => api.saveConfig(CHILDREN_OFF),
}

/** 在当前标签页里找到标题为 title 的设置项，返回它右侧的第一个控件 */
export async function itemControl(page, title, selector = 'input, textarea, select, button') {
  return page.waitForFunction(
    (t, sel) => {
      const row = [...document.querySelectorAll('.row')].find(
        (r) => r.querySelector('.col-lg-6 > div')?.textContent.trim() === t && r.getBoundingClientRect().height,
      )
      return row?.querySelector(`.col-lg-6.text-right ${sel}`.split(', ').join(', .col-lg-6.text-right '))
    },
    { timeout: 10000 },
    title,
    selector,
  )
}

export const configRoutes = [
  { name: 'config-system', route: SYSTEM, settle: 1500 },
  ...TABS.map(([key, label]) => ({
    name: `config-system-${key}`,
    route: SYSTEM,
    settle: 1500,
    state: (page) => openTab(page, label),
  })),
  // 手机上标签栏放不下：点右侧 › 翻一屏、再翻到底
  {
    name: 'config-system-tab-next',
    route: SYSTEM,
    settle: 1500,
    mobileOnly: true,
    state: async (page) => {
      await page.click('.ant-tabs-tab-next')
      await sleep(800)
    },
  },
  {
    name: 'config-system-tab-end',
    route: SYSTEM,
    settle: 1500,
    mobileOnly: true,
    state: async (page) => {
      for (let i = 0; i < 6; i++) {
        const next = await page.$('.ant-tabs-tab-next:not(.ant-tabs-tab-btn-disabled)')
        if (!next) break
        await next.click()
        await sleep(600)
      }
    },
  },
  // 修改后 1.5 秒自动保存：保存成功的提示（全选后重新输入同样的站点名称，保存的内容不变；用第一项，手机上不会滚动页面）。
  // 截图后把站点名称写回读取到的值，防止输入出错时改动后端
  {
    name: 'config-system-saved',
    route: SYSTEM,
    settle: 1500,
    setup: async (api) => ({ app_name: (await api.fetchConfig('site')).app_name }),
    teardown: (api, saved) => api.saveConfig(saved),
    state: async (page) => {
      const input = await itemControl(page, '站点名称', 'input')
      await input.click()
      await input.evaluate((el) => el.select())
      await page.keyboard.type('V2Board')
      await sleep(2600)
    },
  },
  // 发送测试邮件（后端写一条邮件日志，截图后由 teardown 删除）：成功弹窗
  {
    name: 'config-system-test-mail',
    route: SYSTEM,
    settle: 1500,
    teardown: (api) => api.sql("DELETE FROM v2_mail_log WHERE subject = 'This is v2board test email'"),
    state: async (page) => {
      await openTab(page, '邮件')
      await (await itemControl(page, '发送测试邮件', 'button')).click()
      await sleep(4000)
    },
  },
  { name: 'config-system-site-children', route: SYSTEM, settle: 1500, ...withChildren },
  ...[
    ['safe', '安全'],
    ['subscribe', '订阅'],
    ['invite', '邀请&佣金'],
    ['telegram', 'Telegram'],
  ].map(([key, label]) => ({
    name: `config-system-${key}-children`,
    route: SYSTEM,
    settle: 1500,
    ...withChildren,
    state: (page) => openTab(page, label),
  })),
  // 支付配置：演示数据有两个 EPay 支付方式（支付宝启用、微信支付停用）
  { name: 'config-payment', route: PAYMENT },
  {
    name: 'config-payment-tooltip',
    route: PAYMENT,
    desktopOnly: true,
    state: async (page) => {
      await page.hover('.ant-table-thead .anticon-question-circle')
      await sleep(800)
    },
  },
  // 添加：接口列表的第一个是 PaytaroQR（带 Paytaro 提示）
  {
    name: 'config-payment-modal-create',
    route: PAYMENT,
    state: async (page) => {
      await clickText(page, 'button', '添加支付方式')
      await sleep(800)
    },
  },
  {
    name: 'config-payment-modal-methods',
    route: PAYMENT,
    state: async (page) => {
      await clickText(page, 'button', '添加支付方式')
      await sleep(800)
      const groups = await page.$$('.ant-modal-body .form-group')
      for (const group of groups) {
        if ((await group.$eval('label', (el) => el.textContent.trim())) !== '接口文件') continue
        await (await group.$('.ant-select')).click()
        break
      }
      await sleep(800)
    },
  },
  {
    name: 'config-payment-modal-edit',
    route: PAYMENT,
    state: async (page) => {
      await clickText(page, FIXED_END_LINK, '编辑')
      await sleep(800)
    },
  },
  // 编辑时切换接口：配置表单换成新接口的字段
  {
    name: 'config-payment-modal-switch',
    route: PAYMENT,
    state: async (page) => {
      await clickText(page, FIXED_END_LINK, '编辑')
      await sleep(800)
      const groups = await page.$$('.ant-modal-body .form-group')
      for (const group of groups) {
        if ((await group.$eval('label', (el) => el.textContent.trim())) !== '接口文件') continue
        await (await group.$('.ant-select')).click()
        break
      }
      await sleep(600)
      await clickText(page, SELECT_OPTION, 'AlipayF2F')
      // 下拉关闭后鼠标停在下面的输入框上（原版显示悬停边框，新版要等鼠标再次移动才更新），截图前把鼠标移到标题上
      await page.hover('.ant-modal-title')
      await sleep(600)
    },
  },
  {
    name: 'config-payment-drop-confirm',
    route: PAYMENT,
    state: async (page) => {
      await clickText(page, FIXED_END_LINK, '删除')
    },
  },
  // 主题配置：演示环境只有 default 主题（当前主题），卡片背景图来自 unsplash（新旧版加载同一张图）
  { name: 'config-theme', route: THEME, settle: 2000 },
  {
    name: 'config-theme-button-hover',
    route: THEME,
    settle: 2000,
    desktopOnly: true,
    state: async (page) => {
      const buttons = await page.$$('.block .btn-outline-light')
      await buttons[1].hover()
      await sleep(600)
    },
  },
  {
    name: 'config-theme-modal',
    route: THEME,
    settle: 2000,
    state: async (page) => {
      await clickText(page, 'button', '主题设置')
      await sleep(800)
    },
  },
  {
    name: 'config-theme-modal-select',
    route: THEME,
    settle: 2000,
    state: async (page) => {
      await clickText(page, 'button', '主题设置')
      await sleep(800)
      await (await page.$('.ant-modal-body .ant-select')).click()
      await sleep(800)
    },
  },
  // 保存（提交读取到的原样设置）：提示「保存成功」，弹窗不关闭
  {
    name: 'config-theme-saved',
    route: THEME,
    settle: 2000,
    state: async (page) => {
      await clickText(page, 'button', '主题设置')
      await sleep(1000)
      await (await page.$('.ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
]
