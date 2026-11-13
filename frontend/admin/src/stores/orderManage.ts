// 订单管理的列表状态（原版 dva model order，模块 3moC）：全局状态，
// 仪表盘「立即处理」、用户管理「TA的订单」会先在这里设置过滤条件（presetFilter，不拉取），再跳到订单页，由订单页挂载时拉取一次
// （原版每追加一个条件就拉取一次、跳过去后再拉取一次，有意修正）。
//   - 拉取参数为 { filter, ...pagination }；每个操作成功后重新拉取（不等待）
//   - 离开页面时重置（empty），过滤条件清空
import { create } from 'zustand'
import { assignOrder, cancelOrder, fetchOrders, markOrderPaid, updateOrder } from '@/api/services/order'
import type { FilterCondition, Order } from '@/api/types'

export interface OrderPagination {
  pageSize: number
  current: number
  total?: number
}

interface OrderManageState {
  orders: Order[]
  fetchLoading: boolean
  assignLoading: boolean
  pagination: OrderPagination
  filter: FilterCondition[]
  setState: (state: Partial<OrderManageState>) => void
  empty: () => void
  fetch: () => Promise<void>
  /** 过滤器抽屉「检索」：回到第 1 页 */
  filterBy: (filter: FilterCondition[]) => void
  /** 跳到订单页之前设置过滤条件并回到第 1 页（不拉取，订单页挂载时拉取） */
  presetFilter: (filter: FilterCondition[]) => void
  changeTable: (pagination: Partial<OrderPagination>) => void
  /** 修改佣金状态 */
  update: (tradeNo: string, key: string, value: unknown) => Promise<void>
  /** 标记已支付；已取消订单补单时带上备注（v3board），返回是否成功（补单弹窗只在成功时关闭） */
  paid: (tradeNo: string, remark?: string) => Promise<boolean>
  cancel: (tradeNo: string) => Promise<void>
  assign: (params: Record<string, unknown>, callback?: () => void) => Promise<void>
}

const initialState = () => ({
  orders: [] as Order[],
  fetchLoading: false,
  assignLoading: false,
  // 原版初始分页为 { current: 0 }（共用同一个对象，用过过滤条件后才变成 1），第一次进入订单页时请求 current=0，已修正
  pagination: { pageSize: 10, current: 1 } as OrderPagination,
  filter: [] as FilterCondition[],
})

export const useOrderManageStore = create<OrderManageState>((set, get) => {
  const refetch = () => void get().fetch()
  /** 成功后重新拉取 */
  const run = async (request: Promise<{ code: number }>) => {
    const res = await request
    if (res.code === 200) refetch()
  }

  return {
    ...initialState(),
    setState: (state) => set(state),
    empty: () => set(initialState()),

    fetch: async () => {
      const t = get()
      set({ fetchLoading: true })
      const res = await fetchOrders({ filter: t.filter, ...t.pagination })
      set({ fetchLoading: false })
      if (res.code !== 200) return
      set({ orders: res.data ?? [], pagination: { ...t.pagination, total: res.total } })
    },

    filterBy: (filter) => {
      set({ filter, pagination: { ...get().pagination, current: 1 } })
      refetch()
    },

    presetFilter: (filter) => set({ filter, pagination: { ...get().pagination, current: 1 } }),

    changeTable: (pagination) => {
      set({ pagination: { ...get().pagination, ...pagination } })
      refetch()
    },

    update: (tradeNo, key, value) => run(updateOrder(tradeNo, key, value)),
    paid: async (tradeNo, remark) => {
      const res = await markOrderPaid(tradeNo, remark)
      if (res.code === 200) refetch()
      return res.code === 200
    },
    cancel: (tradeNo) => run(cancelOrder(tradeNo)),

    assign: async (params, callback) => {
      set({ assignLoading: true })
      // 与原版一致：金额直接乘 100（不取整）
      const res = await assignOrder({ ...params, total_amount: 100 * Number(params.total_amount) })
      set({ assignLoading: false })
      if (res.code !== 200) return
      refetch()
      callback?.()
    },
  }
})
