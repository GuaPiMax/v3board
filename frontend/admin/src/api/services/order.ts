import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Order } from '../types'

/** 列表：参数为 { filter, ...pagination }（与原版 model order 的顺序一致） */
export const fetchOrders = (params: object) => get<Order[]>(adminPath('/order/fetch'), params)
export const getOrderDetail = (id: number) => post<Order>(adminPath('/order/detail'), { id })
/** 修改佣金状态 */
export const updateOrder = (tradeNo: string, key: string, value: unknown) =>
  post<boolean>(adminPath('/order/update'), { trade_no: tradeNo, [key]: value })
/** 标记已支付；已取消订单补单时带上备注（v3board） */
export const markOrderPaid = (tradeNo: string, remark?: string) =>
  post<boolean>(adminPath('/order/paid'), remark ? { trade_no: tradeNo, remark } : { trade_no: tradeNo })
export const cancelOrder = (tradeNo: string) => post<boolean>(adminPath('/order/cancel'), { trade_no: tradeNo })
/** 分配订单（金额单位为分） */
export const assignOrder = (params: object) => post<string>(adminPath('/order/assign'), params)
