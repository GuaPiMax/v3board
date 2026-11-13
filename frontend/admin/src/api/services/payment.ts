import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Payment, PaymentForm } from '../types'

export const fetchPayments = () => get<Payment[]>(adminPath('/payment/fetch'))
/** 可用的支付接口（Paytaro 系列排在最前） */
export const getPaymentMethods = () => get<string[]>(adminPath('/payment/getPaymentMethods'))
/** id 为编辑的支付方式时，表单里带上已保存的配置 */
export const getPaymentForm = (payment: string | undefined, id: number | undefined) =>
  post<PaymentForm>(adminPath('/payment/getPaymentForm'), { payment, id })
/** 与原版一致：编辑时把整条记录原样提交（notify_url 等由后端忽略）；启用开关另有 show 接口 */
export const savePayment = (params: object) => post<boolean>(adminPath('/payment/save'), params)
/** 切换启用状态 */
export const showPayment = (id: number) => post<boolean>(adminPath('/payment/show'), { id })
export const dropPayment = (id: number) => post<boolean>(adminPath('/payment/drop'), { id })
export const sortPayments = (ids: number[]) => post<boolean>(adminPath('/payment/sort'), { ids })
