import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { ConfigGroups, DomainRewriteRule, NodeWhitelistRule } from '../types'

/** key 为分组名（site / frontend / ...），不传时返回全部分组 */
export const fetchConfig = (key?: string) => get<ConfigGroups>(adminPath('/config/fetch'), { key })
/** 保存配置：后端只更新请求里带的字段（系统配置页每次提交一个分组的全部字段） */
export const saveConfig = (params: object) => post<boolean>(adminPath('/config/save'), params)
export const getEmailTemplate = () => get<string[]>(adminPath('/config/getEmailTemplate'))
export const getThemeTemplate = () => get<string[]>(adminPath('/config/getThemeTemplate'))
/** 带上输入框里的机器人 Token（原版不传，后端使用已保存的 Token） */
export const setTelegramWebhook = (token: string) =>
  post<boolean>(adminPath('/config/setTelegramWebhook'), { telegram_bot_token: token })
/** 响应里的 log 为发送结果（TestMailLog） */
export const testSendMail = () => post<boolean>(adminPath('/config/testSendMail'))

// 以下为 v3board 独有接口：订阅域名重写规则、订阅节点 UA 白名单规则（整表读写，保存发 JSON）
export const fetchDomainRewriteRules = () => get<DomainRewriteRule[]>(adminPath('/config/fetchDomainRewriteRules'))
export const saveDomainRewriteRules = (rules: DomainRewriteRule[]) =>
  post<boolean>(adminPath('/config/saveDomainRewriteRules'), { rules }, true)
export const fetchSubscribeNodeWhitelistRules = () =>
  get<NodeWhitelistRule[]>(adminPath('/config/fetchSubscribeNodeWhitelistRules'))
export const saveSubscribeNodeWhitelistRules = (rules: NodeWhitelistRule[]) =>
  post<boolean>(adminPath('/config/saveSubscribeNodeWhitelistRules'), { rules }, true)
