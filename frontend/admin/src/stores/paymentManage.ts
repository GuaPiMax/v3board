// 支付配置（原版 dva model payment，模块 N9RS）：与原版一样是全局状态，离开页面不重置。
//   - 保存、切换启用、删除、排序成功后重新拉取列表（不等待）
//   - 排序：先在本地移动，再提交全部 id，结束后重新拉取。有意修正：原版提交失败时不重新拉取，列表一直显示加载中
//     （加载状态只在拉取结束时取消）；新版失败时也重新拉取，恢复后端的顺序
import { arrayMove } from '@dnd-kit/sortable'
import { create } from 'zustand'
import {
  dropPayment,
  fetchPayments,
  getPaymentForm,
  getPaymentMethods,
  savePayment,
  showPayment,
  sortPayments,
} from '@/api/services/payment'
import type { Payment, PaymentForm } from '@/api/types'

interface PaymentManageState {
  payments: Payment[]
  fetchLoading: boolean
  fetch: () => Promise<void>
  getPaymentMethods: () => Promise<string[] | undefined>
  getPaymentForm: (payment: string | undefined, id: number | undefined) => Promise<PaymentForm | undefined>
  /** complete：保存成功后调用（先于重新拉取） */
  save: (params: object, complete?: () => void) => Promise<void>
  /** 切换启用状态 */
  show: (id: number) => Promise<void>
  drop: (id: number) => Promise<void>
  sort: (fromIndex: number, toIndex: number) => Promise<void>
}

export const usePaymentManageStore = create<PaymentManageState>((set, get) => {
  const refetch = () => void get().fetch()

  return {
    payments: [],
    fetchLoading: false,

    fetch: async () => {
      set({ fetchLoading: true })
      const res = await fetchPayments()
      set({ fetchLoading: false })
      if (res.code !== 200) return
      set({ payments: res.data ?? [] })
    },

    getPaymentMethods: async () => {
      const res = await getPaymentMethods()
      if (res.code !== 200) return undefined
      return res.data
    },

    getPaymentForm: async (payment, id) => {
      const res = await getPaymentForm(payment, id)
      if (res.code !== 200) return undefined
      return res.data
    },

    save: async (params, complete) => {
      const res = await savePayment(params)
      if (res.code !== 200) return
      complete?.()
      refetch()
    },

    show: async (id) => {
      const res = await showPayment(id)
      if (res.code !== 200) return
      refetch()
    },

    drop: async (id) => {
      const res = await dropPayment(id)
      if (res.code !== 200) return
      refetch()
    },

    sort: async (fromIndex, toIndex) => {
      set({ fetchLoading: true })
      const payments = arrayMove(get().payments, fromIndex, toIndex)
      set({ payments })
      await sortPayments(payments.map((payment) => payment.id))
      refetch()
    },
  }
})
