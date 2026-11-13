// M5（系统配置、支付配置、主题配置）的请求一致性场景。会真实调用后端，改动的数据在场景结束后恢复：
//   - 系统配置 / 主题设置：场景前读取后端的配置文件（v2b-demo/src/config 下，由后端的保存接口写入），
//     旧版跑完、新版跑前与场景结束后原样写回并重建配置缓存，两边从同样的配置开始
//   - 支付方式：改动用 sql.sh 直接恢复；新建的「请求比对-<target>」支付方式在场景里删除
//   - Telegram「一键设置」会让后端去请求 Telegram 接口，这里只记录请求、在浏览器里中止（abort），不发到后端
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { clickText, dragRow, FIXED_END_LINK, SELECT_OPTION } from './actions.mjs'
import { projectRoot } from './lib.mjs'
import { api, sql } from './requests-user.mjs'
import { itemControl, openTab } from './routes-config.mjs'

const DOCKER_DIR = path.resolve(projectRoot, '../v2b-demo')
const CONFIG_FILES = ['config/v2board.php', 'config/theme/default.php']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SYSTEM = '/config/system'
const PAYMENT = '/config/payment'
const THEME = '/config/theme'
/** 自动保存等待 1.5 秒，再留出保存与重新读取的时间 */
const AFTER_SAVE = 3200

/** 在 php 容器里执行命令（配置文件在容器里读写：宿主机刚写入的文件，容器里立即读取可能还是共享目录缓存的旧内容） */
function inContainer(args, input) {
  return execFileSync('docker', ['compose', 'exec', '-T', 'php', ...args], {
    cwd: DOCKER_DIR,
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
  })
}
/** 读取后端配置文件（场景前） */
export function snapshotConfig() {
  return CONFIG_FILES.map((file) => inContainer(['cat', file]))
}
// php-fpm 开着 OPcache（revalidate_freq=2）：2 秒内再次读取刚改过的配置文件，拿到的仍是之前的编译结果
// （后端保存时调用的 opcache_reset() 要到下一个请求才生效），于是保存后重建的配置缓存还是旧值。
// 写回前后各等 2 秒多：写入与 fpm 上次读取不在同一秒（OPcache 按秒比较修改时间），写回后 fpm 下次读取时会重新检查
const OPCACHE_REVALIDATE = 2100
/** 写回配置文件并重建配置缓存 */
export async function restoreConfig(_token, files) {
  await sleep(OPCACHE_REVALIDATE)
  CONFIG_FILES.forEach((file, i) => inContainer(['sh', '-c', `cat > ${file}`], files[i]))
  inContainer(['php', 'artisan', 'config:cache'])
  await sleep(OPCACHE_REVALIDATE)
}
/** 场景前后恢复配置；prepare：两边开始前都要做的准备（例如打开某个子项），返回接口响应，失败时报错 */
function withConfig(prepare) {
  const run = async (token) => {
    if (!prepare) return
    const res = await prepare(token)
    if (res?.data !== true) throw new Error(`准备数据失败：${JSON.stringify(res)}`)
  }
  return {
    before: async (token) => {
      const files = snapshotConfig()
      await run(token)
      return files
    },
    between: async (token, files) => {
      await restoreConfig(token, files)
      await run(token)
    },
    after: restoreConfig,
  }
}
/** 全选后输入（三击在这些输入框上不一定能全选） */
export async function retype(input, page, text) {
  await input.click()
  await input.evaluate((el) => el.select())
  await page.keyboard.type(text)
}
/** 有意修正：边栏 / 头部风格保存 frontend 分组（原版提交站点分组的全部字段再加上这一项）；值为演示环境的默认配置 */
const FRONTEND_GROUP = (req) =>
  req.replace(
    /^(POST \S+\/config\/save\s+\[[^\]]+\]\s)logo=.*&(frontend_theme_(?:sidebar|header))=(\w+)$/,
    (_, head, key, value) => {
      const group = { frontend_theme: 'default', frontend_theme_sidebar: 'light', frontend_theme_header: 'dark', frontend_theme_color: 'default' }
      group[key] = value
      return `${head}${Object.entries(group).map(([k, v]) => `${k}=${v}`).join('&')}&frontend_background_url=`
    },
  )
/** 有意修正：订阅链接有效时间保存 subscribe 分组（原版提交安全分组的全部字段再加上这一项） */
const SUBSCRIBE_GROUP = (req) =>
  req.replace(
    /^(POST \S+\/config\/save\s+\[[^\]]+\]\s)email_verify=.*&show_subscribe_expire=(\d+)$/,
    (_, head, value) =>
      `${head}plan_change_enable=1&reset_traffic_method=0&surplus_enable=1&allow_new_period=0&new_order_event_id=0&renew_order_event_id=0&change_order_event_id=0&show_info_to_server_enable=0&show_subscribe_method=2&show_subscribe_expire=${value}`,
  )
/** 编辑支付方式时整条记录原样提交，其中 updated_at 在旧版保存后会变 */
const PAYMENT_TIME = (req) => req.replace(/\b(created_at|updated_at)=\d+/g, '$1=<time>')

export const configScenarios = {
  // 进入系统配置：读取全部配置、订阅列表、邮件模板与主题模板
  'config-system-load': { route: SYSTEM },
  // 修改后 1.5 秒自动保存所在分组（提交该分组的全部字段）并重新读取
  'config-system-site-save': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page) => {
      await retype(await itemControl(page, '站点名称', 'input'), page, 'V2Board')
      await sleep(AFTER_SAVE)
    },
  },
  'config-system-safe-toggle': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page) => {
      await openTab(page, '安全')
      await (await itemControl(page, '邮箱验证', 'button')).click()
      await sleep(AFTER_SAVE)
      await (await itemControl(page, '邮箱验证', 'button')).click()
      await sleep(AFTER_SAVE)
    },
  },
  // 下拉框：选中后值为字符串
  'config-system-subscribe-select': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page) => {
      await openTab(page, '订阅')
      const select = await itemControl(page, '月流量重置方式', 'select')
      await select.select('1')
      await sleep(AFTER_SAVE)
      await (await itemControl(page, '月流量重置方式', 'select')).select('0')
      await sleep(AFTER_SAVE)
    },
  },
  // 提现方式按逗号拆成数组提交；邀请佣金百分比按整数提交
  'config-system-invite-fields': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page) => {
      await openTab(page, '邀请&佣金')
      await retype(await itemControl(page, '邀请佣金百分比', 'input'), page, '10')
      await retype(await itemControl(page, '提现方式', 'textarea'), page, '支付宝,USDT,Paypal')
      await sleep(AFTER_SAVE)
    },
  },
  // 充值奖励：拆成数组提交，清空时提交一个空字符串
  'config-system-deposit': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page) => {
      await openTab(page, '充值')
      await retype(await itemControl(page, '充值奖励', 'textarea'), page, '50:18,100:38')
      await sleep(AFTER_SAVE)
      const textarea = await itemControl(page, '充值奖励', 'textarea')
      await textarea.click()
      await textarea.evaluate((el) => el.select())
      await page.keyboard.press('Backspace')
      await sleep(AFTER_SAVE)
    },
  },
  // 有意修正：边栏风格写入 frontend 分组（原版写入 site 分组，提交站点分组的全部字段，保存并重新读取后开关才切换）
  'config-system-frontend-switch': {
    route: SYSTEM,
    ...withConfig(),
    fixOld: FRONTEND_GROUP,
    run: async (page) => {
      await openTab(page, '个性化')
      await (await itemControl(page, '边栏风格', 'button')).click()
      await sleep(AFTER_SAVE)
      await (await itemControl(page, '边栏风格', 'button')).click()
      await sleep(AFTER_SAVE)
      await (await itemControl(page, '主题色', 'select')).select('green')
      await sleep(AFTER_SAVE)
    },
  },
  'config-system-server-number': {
    route: SYSTEM,
    ...withConfig(),
    run: async (page) => {
      await openTab(page, '节点')
      await retype(await itemControl(page, '节点拉取动作轮询间隔', 'input'), page, '60')
      await sleep(AFTER_SAVE)
    },
  },
  // 有意修正：「订阅链接有效时间」写入 subscribe 分组（原版写入 safe 分组，提交安全分组的全部字段）
  'config-system-subscribe-expire': {
    route: SYSTEM,
    ...withConfig((token) => api(token, 'POST', '/config/save', { show_subscribe_method: 2 })),
    fixOld: SUBSCRIBE_GROUP,
    run: async (page) => {
      await openTab(page, '订阅')
      // 输入与原值不同的数字（原值是 5；输入同样的值不会触发修改）
      await retype(await itemControl(page, '订阅链接有效时间(分钟)', 'input'), page, '10')
      await sleep(AFTER_SAVE)
    },
  },
  // 有意修正：1.5 秒内先后改了两个分组，新版两个分组都保存（原版只保存后一个，站点分组的修改丢失）
  'config-system-two-groups': {
    route: SYSTEM,
    ...withConfig(),
    knownNewOnly: [/config\/save .*app_name=/],
    run: async (page) => {
      await retype(await itemControl(page, '站点名称', 'input'), page, 'V2Board')
      await openTab(page, '安全')
      await (await itemControl(page, '邮箱验证', 'button')).click()
      await sleep(AFTER_SAVE + 500)
    },
  },
  // 已填写机器人 Token 时才有「一键设置」。有意修正：带上输入框里的 Token（原版不带，后端用已保存的 Token）
  'config-system-telegram-webhook': {
    route: SYSTEM,
    ...withConfig((token) => api(token, 'POST', '/config/save', { telegram_bot_token: '123456:request-diff' })),
    abort: /\/config\/setTelegramWebhook/,
    fixOld: (req) => req.replace(/(\/config\/setTelegramWebhook\s+\[[^\]]+\]\s)$/, '$1telegram_bot_token=123456%3Arequest-diff'),
    run: async (page) => {
      await openTab(page, 'Telegram')
      await (await itemControl(page, '设置Webhook', 'button')).click()
      await sleep(1500)
    },
  },
  // 发送测试邮件（开发环境的邮件写进日志）：结束后删除这次的邮件记录
  'config-system-test-mail': {
    route: SYSTEM,
    after: () => sql("DELETE FROM v2_mail_log WHERE subject = 'This is v2board test email'"),
    run: async (page) => {
      await openTab(page, '邮件')
      await (await itemControl(page, '发送测试邮件', 'button')).click()
      await sleep(4500)
    },
  },

  // 支付配置
  'config-payment-load': { route: PAYMENT },
  // 启用开关：切换两次（恢复原状）
  'config-payment-toggle': {
    route: PAYMENT,
    after: () => sql('UPDATE v2_payment SET enable = 0 WHERE id = 2'),
    run: async (page) => {
      await (await page.$$('.ant-table-tbody .ant-switch'))[1].click()
      await sleep(1500)
      await (await page.$$('.ant-table-tbody .ant-switch'))[1].click()
      await sleep(1500)
    },
  },
  // 编辑：打开时读取接口列表与配置表单，保存时整条记录原样提交（配置为读取到的表单）
  'config-payment-edit': {
    route: PAYMENT,
    normalize: PAYMENT_TIME,
    between: () => sql("UPDATE v2_payment SET name = '支付宝', icon = NULL, notify_domain = NULL WHERE id = 1"),
    after: () => sql("UPDATE v2_payment SET name = '支付宝', icon = NULL, notify_domain = NULL WHERE id = 1"),
    run: async (page) => {
      await clickText(page, FIXED_END_LINK, '编辑')
      await sleep(1000)
      const inputs = await page.$$('.ant-modal-wrap:not([style*="display: none"]) .ant-modal-body input.ant-input')
      await retype(inputs[0], page, '支付宝2')
      await (await page.$('.ant-modal-wrap:not([style*="display: none"]) .ant-modal-footer .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  // 添加：默认选第一个接口（PaytaroQR），切换到 EPay 后填写配置并保存，再删除这条（确认框）
  'config-payment-create-drop': {
    route: PAYMENT,
    before: () => sql("DELETE FROM v2_payment WHERE name LIKE '请求比对-%'"),
    // 两边新建的支付方式 id 相同（删除请求带 id）
    between: () => {
      sql("DELETE FROM v2_payment WHERE name LIKE '请求比对-%'")
      sql('ALTER TABLE v2_payment AUTO_INCREMENT = 3')
    },
    after: () => {
      sql("DELETE FROM v2_payment WHERE name LIKE '请求比对-%'")
      sql('ALTER TABLE v2_payment AUTO_INCREMENT = 3')
    },
    run: async (page, target) => {
      await clickText(page, 'button', '添加支付方式')
      await sleep(1000)
      const modal = '.ant-modal-wrap:not([style*="display: none"])'
      const inputs = await page.$$(`${modal} .ant-modal-body input.ant-input`)
      await inputs[0].click()
      await page.keyboard.type(`请求比对-${target}`)
      const groups = await page.$$(`${modal} .ant-modal-body .form-group`)
      for (const group of groups) {
        if ((await group.$eval('label', (el) => el.textContent.trim())) !== '接口文件') continue
        await (await group.$('.ant-select')).click()
        break
      }
      await sleep(600)
      await clickText(page, SELECT_OPTION, 'EPay')
      await sleep(1200)
      const fields = await page.$$(`${modal} .ant-modal-body input.ant-input`)
      const values = ['https://pay.example.com', '1002', 'key&=?', 'alipay']
      // 显示名称、图标、通知域名、两个手续费之后是接口的配置字段
      for (const [i, value] of values.entries()) {
        await fields[5 + i].click()
        await page.keyboard.type(value)
      }
      await (await page.$(`${modal} .ant-modal-footer .ant-btn-primary`)).click()
      await sleep(1500)
      // 列表按 sort 升序，新建的（sort 为空）排在最前
      const index = await page.$$eval('.ant-table-tbody tr.ant-table-row', (rows) =>
        rows.findIndex((row) => row.textContent.includes('请求比对-')),
      )
      await clickText(page, FIXED_END_LINK, '删除', index)
      await (await page.$('.ant-modal-confirm .ant-modal-confirm-btns .ant-btn-primary')).click()
      await sleep(1500)
    },
  },
  // 拖动排序：把第 1 行拖到第 2 行、再拖回来
  'config-payment-sort': {
    route: PAYMENT,
    after: () => sql('UPDATE v2_payment SET sort = id'),
    run: async (page) => {
      await dragRow(page, 0, 1)
      await dragRow(page, 0, 1)
    },
  },

  // 主题配置
  'config-theme-load': { route: THEME },
  // 主题设置：读取设置，改主题色后保存（设置为 base64 的 JSON），再改回来保存
  'config-theme-save': {
    route: THEME,
    ...withConfig(),
    run: async (page) => {
      await clickText(page, 'button', '主题设置')
      await sleep(1000)
      const pick = async (label) => {
        await (await page.$('.ant-modal-body .ant-select')).click()
        await sleep(600)
        await clickText(page, SELECT_OPTION, label)
        await (await page.$('.ant-modal-footer .ant-btn-primary')).click()
        await sleep(1500)
      }
      await pick('奶绿色')
      await pick('默认(蓝色)')
    },
  },
  // 激活主题：先把当前主题改成不存在的 v2board，让 default 显示「激活主题」
  'config-theme-activate': {
    route: THEME,
    ...withConfig((token) => api(token, 'POST', '/config/save', { frontend_theme: 'v2board' })),
    run: async (page) => {
      await clickText(page, 'button', '激活主题')
      await sleep(1500)
    },
  },
}
