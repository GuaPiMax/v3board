// M5（系统配置、支付配置）有意修正的行为检查，由 fixes.mjs 运行（新版应全部通过，原版应全部不通过）。
// 改系统配置的检查在前后读写后端配置文件（restoreConfig），支付方式的改动用 sql.sh 恢复；
// intercept：返回 'abort' 在浏览器里中止请求（不发到后端），返回对象则用它作为响应（模拟失败）
import { clickText, dragRow, FIXED_END_LINK, SELECT_OPTION } from './actions.mjs'
import { config } from './lib.mjs'
import { restoreConfig, retype, snapshotConfig } from './requests-config.mjs'
import { api, sql } from './requests-user.mjs'
import { itemControl, openTab } from './routes-config.mjs'

const SYSTEM = '/config/system'
const PAYMENT = '/config/payment'
const MODAL = '.ant-modal-wrap:not([style*="display: none"])'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** 自动保存等待 1.5 秒，再留出保存与重新读取的时间 */
const AFTER_SAVE = 3200

/** 记录之后发往 path 的请求（不含预检） */
function watch(page, path, list = []) {
  page.on('request', (r) => {
    if (r.url().includes(path) && r.method() !== 'OPTIONS') list.push({ path, body: r.postData() ?? '' })
  })
  return list
}
/** 前后读写后端配置文件；prepare：检查前通过接口准备配置 */
function withConfig(prepare) {
  return {
    before: async (token) => {
      const files = snapshotConfig()
      if (prepare) await prepare(token)
      return files
    },
    after: (files) => restoreConfig(undefined, files),
  }
}
/** 当前可见的设置项里是否有标题为 title 的一项 */
const hasItem = (page, title) =>
  page.evaluate(
    (t) =>
      [...document.querySelectorAll('.row')].some(
        (r) => r.querySelector('.col-lg-6 > div')?.textContent.trim() === t && r.getBoundingClientRect().height,
      ),
    title,
  )
/** 弹窗里标签为 label 的表单项 */
async function modalGroup(page, label) {
  for (const group of await page.$$(`${MODAL} .ant-modal-body .form-group`)) {
    if ((await group.$eval('label', (el) => el.textContent.trim())) === label) return group
  }
  throw new Error(`弹窗里没有「${label}」`)
}
/** 在弹窗的「接口文件」里选择支付接口 */
async function pickPayment(page, name) {
  await (await (await modalGroup(page, '接口文件')).$('.ant-select')).click()
  await sleep(600)
  await clickText(page, SELECT_OPTION, name)
  await page.hover(`${MODAL} .ant-modal-title`)
  await sleep(800)
}
/** 添加支付方式：填写名称，选 EPay 并填写配置 */
async function fillNewPayment(page, name) {
  await clickText(page, 'button', '添加支付方式')
  await sleep(1000)
  await (await (await modalGroup(page, '显示名称')).$('input')).type(name)
  await pickPayment(page, 'EPay')
  for (const [label, value] of [
    ['URL', 'https://pay.example.com'],
    ['PID', '1003'],
    ['KEY', 'fix-check'],
    ['TYPE', 'alipay'],
  ]) {
    await (await (await modalGroup(page, label)).$('input')).type(value)
  }
}
const okButton = `${MODAL} .ant-modal-footer .ant-btn-primary`
const cleanupPayments = () => {
  sql("DELETE FROM v2_payment WHERE name LIKE '修正验证%'")
  sql('ALTER TABLE v2_payment AUTO_INCREMENT = 3')
}

export const configChecks = {
  // 1.5 秒内先后修改两个分组：两个分组都保存；前一个分组保存后的重新读取不覆盖后一个分组的修改（到后端确认）
  'config-two-groups': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page, expect, token) => {
      const saves = watch(page, '/config/save')
      await retype(await itemControl(page, '货币单位', 'input'), page, 'USD')
      await openTab(page, '安全')
      // 页面在「货币单位」处向下滚动过，开关可能落在固定顶栏下面，先滚到屏幕中间再点
      const toggle = await itemControl(page, '邮箱验证', 'button')
      await toggle.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await toggle.click()
      await sleep(4500)
      expect('保存请求数', saves.length, 2)
      expect('站点分组已保存', saves.some((r) => r.body.includes('currency=USD')), true)
      expect('安全分组保存的是修改后的值', saves.some((r) => r.body.includes('email_verify=1')), true)
      const saved = (await api(token, 'GET', '/config/fetch')).data
      expect('后端的货币单位', saved?.site?.currency, 'USD')
      expect('后端的邮箱验证', saved?.safe?.email_verify, 1)
    },
  },
  // 边栏风格：点击后开关立即切换，保存的是 frontend 分组
  'config-frontend-group': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page, expect) => {
      const saves = watch(page, '/config/save')
      await openTab(page, '个性化')
      const toggle = await itemControl(page, '边栏风格', 'button')
      await toggle.click()
      await sleep(300)
      expect('点击后开关立即切换为「暗」', await toggle.evaluate((el) => el.getAttribute('aria-checked')), 'false')
      await sleep(AFTER_SAVE)
      expect('保存请求数', saves.length, 1)
      expect('保存的是 frontend 分组', Boolean(saves[0]?.body.startsWith('frontend_theme=')), true)
      expect('边栏风格为 dark', Boolean(saves[0]?.body.includes('frontend_theme_sidebar=dark')), true)
    },
  },
  // 订阅链接有效时间：保存的是 subscribe 分组
  'config-subscribe-group': {
    route: SYSTEM,
    ...withConfig((token) => api(token, 'POST', '/config/save', { show_subscribe_method: 2 })),
    run: async (page, expect) => {
      const saves = watch(page, '/config/save')
      await openTab(page, '订阅')
      await retype(await itemControl(page, '订阅链接有效时间(分钟)', 'input'), page, '10')
      await sleep(AFTER_SAVE)
      expect('保存请求数', saves.length, 1)
      expect('保存的是 subscribe 分组', Boolean(saves[0]?.body.startsWith('plan_change_enable=')), true)
      expect('有效时间为 10', Boolean(saves[0]?.body.includes('show_subscribe_expire=10')), true)
    },
  },
  // 注册试用选「关闭」：立即隐藏「试用时间」
  'config-trial-hide': {
    route: SYSTEM,
    ...withConfig((token) => api(token, 'POST', '/config/save', { try_out_plan_id: 1 })),
    run: async (page, expect) => {
      expect('选择订阅时显示「试用时间」', await hasItem(page, '试用时间(小时)'), true)
      await (await itemControl(page, '注册试用', 'select')).select('0')
      await sleep(300)
      expect('选「关闭」后立即隐藏', await hasItem(page, '试用时间(小时)'), false)
      await sleep(AFTER_SAVE)
    },
  },
  // 邀请佣金百分比清空：不提交 NaN、不报错
  'config-invite-empty': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page, expect) => {
      const saves = watch(page, '/config/save')
      await openTab(page, '邀请&佣金')
      const input = await itemControl(page, '邀请佣金百分比', 'input')
      await input.click()
      await input.evaluate((el) => el.select())
      await page.keyboard.press('Backspace')
      await sleep(AFTER_SAVE)
      expect('没有提交 NaN', saves.filter((r) => r.body.includes('NaN')).length, 0)
      expect('没有错误提示', await page.$('.ant-notification-notice'), null)
    },
  },
  // 「一键设置」：先保存刚填的 Token，再带上它请求（请求在浏览器里中止，不让后端去访问 Telegram）
  'config-telegram-token': {
    route: SYSTEM,
    ...withConfig((token) => api(token, 'POST', '/config/save', { telegram_bot_token: '123456:old' })),
    intercept: (r) => (r.url().includes('/config/setTelegramWebhook') ? 'abort' : undefined),
    run: async (page, expect) => {
      const requests = []
      watch(page, '/config/save', requests)
      watch(page, '/config/setTelegramWebhook', requests)
      await openTab(page, 'Telegram')
      await retype(await itemControl(page, '机器人Token', 'input'), page, '123456:new')
      await (await itemControl(page, '设置Webhook', 'button')).click()
      await sleep(2500)
      const webhook = requests.findIndex((r) => r.path === '/config/setTelegramWebhook')
      const save = requests.findIndex((r) => r.path === '/config/save' && r.body.includes('telegram_bot_token=123456%3Anew'))
      expect('Webhook 请求带上新 Token', requests[webhook]?.body, 'telegram_bot_token=123456%3Anew')
      expect('新 Token 先保存', save !== -1 && save < webhook, true)
    },
  },
  // 个性化顶部的提示按新版的实际行为说明
  'config-frontend-alert': {
    route: SYSTEM,
    run: async (page, expect) => {
      await openTab(page, '个性化')
      const text = await page.evaluate(
        () =>
          [...document.querySelectorAll('.alert-warning')]
            .find((el) => el.getBoundingClientRect().height)
            ?.textContent.trim(),
      )
      expect(
        '提示内容',
        text,
        '前后分离部署时本页配置同样生效：管理端在登录后和每次打开时读取这里的设置，登录页在首次登录前使用 config.js 中的主题与背景。',
      )
    },
  },
  // 固定手续费 1.1 元：提交 110 分
  'payment-fee-round': {
    route: PAYMENT,
    after: () => sql('UPDATE v2_payment SET handling_fee_fixed = NULL WHERE id = 1'),
    run: async (page, expect) => {
      const saves = watch(page, '/payment/save')
      await clickText(page, FIXED_END_LINK, '编辑')
      await sleep(1000)
      await retype(await (await modalGroup(page, '固定手续费(选填)')).$('input'), page, '1.1')
      await (await page.$(okButton)).click()
      await sleep(1500)
      expect('提交的固定手续费', saves[0]?.body.match(/handling_fee_fixed=([^&]*)/)?.[1], '110')
    },
  },
  // 连点两次「添加」：只提交一次
  'payment-save-once': {
    route: PAYMENT,
    before: cleanupPayments,
    after: cleanupPayments,
    run: async (page, expect) => {
      const saves = watch(page, '/payment/save')
      await fillNewPayment(page, '修正验证-once')
      // 快速点两次（第二次可能在保存请求期间，也可能在保存成功后弹窗关闭的动画期间）
      await page.click(okButton)
      await sleep(50)
      await page.click(okButton)
      await sleep(2000)
      expect('保存请求数', saves.length, 1)
    },
  },
  // 添加成功后再点「添加支付方式」：弹窗已清空
  'payment-add-reset': {
    route: PAYMENT,
    before: cleanupPayments,
    after: cleanupPayments,
    run: async (page, expect) => {
      await fillNewPayment(page, '修正验证-reset')
      await (await page.$(okButton)).click()
      await sleep(2000)
      await clickText(page, 'button', '添加支付方式')
      await sleep(1000)
      expect('显示名称', await (await modalGroup(page, '显示名称')).$eval('input', (el) => el.value), '')
      expect(
        '接口文件为列表第一个',
        await (await modalGroup(page, '接口文件')).$eval('.ant-select', (el) => el.textContent.trim()),
        'PaytaroQR',
      )
    },
  },
  // 编辑时切换接口：输入框显示新接口的值，提交的配置只有新接口的字段（保存请求在浏览器里中止）
  'payment-switch-gateway': {
    route: PAYMENT,
    intercept: (r) => (r.url().includes('/payment/save') ? 'abort' : undefined),
    run: async (page, expect) => {
      const saves = watch(page, '/payment/save')
      await clickText(page, FIXED_END_LINK, '编辑')
      await sleep(1000)
      await pickPayment(page, 'AlipayF2F')
      expect('支付宝APPID', await (await modalGroup(page, '支付宝APPID')).$eval('input', (el) => el.value), '')
      await (await page.$(okButton)).click()
      await sleep(1000)
      expect('提交的配置没有 EPay 的字段', Boolean(saves[0]) && !saves[0].body.includes('config[url]'), true)
    },
  },
  // 排序提交失败（模拟后端返回 500）：结束加载并恢复原来的顺序
  'payment-sort-fail': {
    route: PAYMENT,
    intercept: (r) =>
      r.url().includes('/payment/sort')
        ? {
            status: 500,
            contentType: 'application/json',
            headers: { 'access-control-allow-origin': config.newOrigin, 'access-control-allow-credentials': 'true' },
            body: JSON.stringify({ message: '模拟排序失败' }),
          }
        : undefined,
    run: async (page, expect) => {
      await dragRow(page, 0, 1)
      await sleep(1500)
      expect('加载中已结束', await page.$('.ant-spin-spinning'), null)
      expect(
        '第一行仍是支付宝',
        await page.$eval('.ant-table-tbody tr.ant-table-row', (row) => row.textContent.includes('支付宝')),
        true,
      )
    },
  },
}
