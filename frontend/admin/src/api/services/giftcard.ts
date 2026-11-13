import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Giftcard, PageParams } from '../types'

export const fetchGiftcards = (params: PageParams) => get<Giftcard[]>(adminPath('/giftcard/fetch'), params)
/** 新建 / 编辑 / 批量生成（带 generate_count 时后端直接返回 CSV，跨域失败由页面单独提示） */
export const generateGiftcard = (params: { generate_count?: unknown }) =>
  post<boolean>(adminPath('/giftcard/generate'), params, false, { silentNetworkError: Boolean(params.generate_count) })
export const dropGiftcard = (id: number) => post<boolean>(adminPath('/giftcard/drop'), { id })
