// 原版全局文案常量（模块 tI4l）
export const I18N_TEXT: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'vi-VN': 'Tiếng Việt',
  'ko-KR': '한국어',
}

export const PERIOD_TEXT = {
  month_price: '月付',
  quarter_price: '季付',
  half_year_price: '半年付',
  year_price: '年付',
  two_year_price: '两年付',
  three_year_price: '三年付',
  onetime_price: '一次性',
  reset_price: '流量重置包',
} as const
export type PeriodKey = keyof typeof PERIOD_TEXT
export const PERIOD_KEYS = Object.keys(PERIOD_TEXT) as PeriodKey[]

export const ORDER_STATUS_TEXT: Record<number, string> = {
  0: '待支付',
  1: '开通中',
  2: '已取消',
  3: '已完成',
  4: '已折抵',
}

export const COMMISSION_STATUS_TEXT: Record<number, string> = {
  0: '待确认',
  1: '发放中',
  2: '已发放',
  3: '已驳回',
}

export const ROUTE_ACTION_TEXT = {
  block: '禁止访问(域名目标)',
  block_ip: '禁止访问(IP目标)',
  block_port: '禁止访问(端口目标)',
  protocol: '禁止访问(协议)',
  dns: '指定DNS服务器进行解析',
  route: '指定出站服务器(域名目标)',
  route_ip: '指定出站服务器(IP目标)',
  default_out: '自定义默认出站',
} as const
export type RouteAction = keyof typeof ROUTE_ACTION_TEXT
