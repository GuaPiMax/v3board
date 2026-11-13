// 系统配置（原版 dva model config，模块 6lKK）：与原版一样是全局状态，离开页面不重置（再次进入时先显示上次读取的内容）。
//   - fetch：读取全部分组，提现方式、充值奖励为逗号分隔的字符串时拆成数组
//   - setValue：修改字段后 1.5 秒自动保存该分组的全部字段；保存成功提示「保存成功」并重新读取（不等待）。
//     有意修正：原版所有分组共用一个定时器，1.5 秒内又改了另一个分组时只保存后一个分组，前一个分组的修改丢失；
//     新版按分组各自计时（同一分组内连续修改仍合并成一次保存），重新读取时跳过还在等待保存或正在保存的分组
//     （否则前一个分组保存后的重新读取会把后一个分组的修改覆盖成旧值，随后保存的仍是旧值）
//   - 设置 Webhook、发送测试邮件：请求期间按钮显示加载中，测试邮件的结果用弹窗显示（原版另有一行调试用的 console.log，不保留）
//   - 有意修正：「一键设置」先把 Telegram 分组还没保存的修改保存完，再带上输入框里的 Token 请求；原版不带 Token
//     （后端用已保存的 Token），填写 Token 后 1.5 秒内点击，设置的是旧 Token
import { create } from 'zustand'
import {
  fetchConfig,
  getEmailTemplate,
  getThemeTemplate,
  saveConfig,
  setTelegramWebhook,
  testSendMail,
} from '@/api/services/config'
import type { TestMailLog } from '@/api/types'
import { message } from '@/app/staticApi'
import { showTestMailResult } from '@/pages/config/testMailResult'

/** 配置分组（与后端 config/fetch 的分组一致） */
export type ConfigGroup =
  | 'ticket'
  | 'deposit'
  | 'invite'
  | 'site'
  | 'subscribe'
  | 'frontend'
  | 'server'
  | 'email'
  // v3board 独有分组：邮件提醒
  | 'email_remind'
  | 'telegram'
  | 'app'
  | 'safe'

export type ConfigValues = Record<string, unknown>

/** 修改后自动保存的等待时间 */
export const SAVE_DELAY = 1500

interface ConfigManageState extends Record<ConfigGroup, ConfigValues> {
  /** 系统配置页默认打开的标签 */
  tabs: string
  fetchLoading: boolean
  emailTemplate: string[]
  themeTemplate: string[]
  setTelegramWebhookLoading: boolean
  testSendMailLoading: boolean
  fetch: (key?: string) => Promise<void>
  /** 修改一个字段，SAVE_DELAY 后保存该分组 */
  setValue: (group: ConfigGroup, key: string, value: unknown) => void
  /** 保存该分组的全部字段，返回是否成功 */
  save: (group: ConfigGroup) => Promise<boolean>
  /** 立即保存该分组还在等待的修改（正在保存时等它结束），返回是否成功（没有待保存的修改时为 true） */
  flush: (group: ConfigGroup) => Promise<boolean>
  getEmailTemplate: () => Promise<void>
  getThemeTemplate: () => Promise<void>
  setTelegramWebhook: () => Promise<void>
  testSendMail: () => Promise<void>
}

/** 各分组的自动保存定时器 */
const timers = new Map<ConfigGroup, ReturnType<typeof setTimeout>>()
/** 正在保存的分组 */
const saving = new Map<ConfigGroup, Promise<boolean>>()
/** 有还没保存完的修改（重新读取时保留本地的值） */
const hasPendingChanges = (group: ConfigGroup) => timers.has(group) || saving.has(group)

function splitIfString(group: ConfigValues | undefined, key: string) {
  const value = group?.[key]
  if (group && typeof value === 'string') group[key] = value.split(',')
}

export const useConfigManageStore = create<ConfigManageState>((set, get) => ({
  ticket: {},
  deposit: {},
  invite: {},
  site: {},
  subscribe: {},
  frontend: {},
  server: {},
  email: {},
  email_remind: {},
  telegram: {},
  app: {},
  safe: {},
  tabs: 'site',
  fetchLoading: false,
  emailTemplate: [],
  themeTemplate: [],
  setTelegramWebhookLoading: false,
  testSendMailLoading: false,

  fetch: async (key) => {
    set({ fetchLoading: true })
    const res = await fetchConfig(key)
    set({ fetchLoading: false })
    if (res.code !== 200 || !res.data) return
    const data = res.data
    splitIfString(data.invite, 'commission_withdraw_method')
    // 与原版一致在 site 分组里找白名单后缀（后端实际放在 safe 分组，且本来就是数组，这一步不起作用）
    splitIfString(data.site, 'email_whitelist_suffix')
    splitIfString(data.deposit, 'deposit_bounus')
    const groups = Object.fromEntries(
      Object.entries(data).filter(([group]) => !hasPendingChanges(group as ConfigGroup)),
    )
    set(groups as Partial<ConfigManageState>)
  },

  setValue: (group, key, value) => {
    set({ [group]: { ...get()[group], [key]: value } })
    clearTimeout(timers.get(group))
    timers.set(
      group,
      setTimeout(() => {
        timers.delete(group)
        void get().save(group)
      }, SAVE_DELAY),
    )
  },

  save: async (group) => {
    const request = saveConfig({ ...get()[group] }).then((res) => res.code === 200)
    saving.set(group, request)
    const ok = await request
    saving.delete(group)
    if (!ok) return false
    message.success('保存成功')
    void get().fetch()
    return true
  },

  flush: async (group) => {
    const timer = timers.get(group)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(group)
      return get().save(group)
    }
    return saving.get(group) ?? true
  },

  getEmailTemplate: async () => {
    const res = await getEmailTemplate()
    if (res.code !== 200) return
    set({ emailTemplate: res.data })
  },

  getThemeTemplate: async () => {
    const res = await getThemeTemplate()
    if (res.code !== 200) return
    set({ themeTemplate: res.data })
  },

  setTelegramWebhook: async () => {
    set({ setTelegramWebhookLoading: true })
    // 先保存输入框里的 Token（后端生成回调地址时用已保存的 Token），保存失败时不再设置
    const saved = await get().flush('telegram')
    const res = saved ? await setTelegramWebhook(get().telegram.telegram_bot_token as string) : undefined
    set({ setTelegramWebhookLoading: false })
    if (res?.code !== 200) return
    message.success('webhook 设置成功')
  },

  testSendMail: async () => {
    set({ testSendMailLoading: true })
    const res = await testSendMail()
    set({ testSendMailLoading: false })
    if (res.code !== 200) return
    showTestMailResult(res.log as TestMailLog | undefined)
  },
}))
