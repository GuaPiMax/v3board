import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Coupon, PageParams } from '../types'

export const fetchCoupons = (params: PageParams) => get<Coupon[]>(adminPath('/coupon/fetch'), params)
/** 新建 / 编辑 / 批量生成（带 generate_count 时后端直接返回 CSV，跨域失败由页面单独提示） */
export const generateCoupon = (params: { generate_count?: unknown }) =>
  post<boolean>(adminPath('/coupon/generate'), params, false, { silentNetworkError: Boolean(params.generate_count) })
export const dropCoupon = (id: number) => post<boolean>(adminPath('/coupon/drop'), { id })
export const toggleCouponShow = (id: number) => post<boolean>(adminPath('/coupon/show'), { id })
