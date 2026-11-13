// 工单管理的状态（原版 dva model ticket，模块 e+9n）：全局状态，离开页面不重置（回到列表时保留分页、状态和筛选）。
//   - 列表参数为 { ...pagination, ...filter }，filter 默认 { status: 0 }（已开启）
//   - 工单详情（fetchById）读取后，若用户管理里还没有这个用户就读取一次（详情页的「用户管理」抽屉使用）
import { create } from 'zustand'
import { closeTicket, fetchTicket, fetchTickets, replyTicket } from '@/api/services/ticket'
import type { Ticket, TicketDetail } from '@/api/types'
import { message } from '@/app/staticApi'
import { useUserManageStore } from './userManage'

export interface TicketPagination {
  pageSize: number
  current: number
  total?: number
}

export type TicketFilter = Record<string, unknown>

interface TicketManageState {
  tickets: Ticket[]
  fetchLoading: boolean
  ticket: Partial<TicketDetail> & Pick<TicketDetail, 'message'>
  pagination: TicketPagination
  filter: TicketFilter
  replyLoading: boolean
  fetch: () => Promise<void>
  fetchById: (id: number | string) => Promise<void>
  close: (id: number) => Promise<void>
  reply: (id: number | string, msg: unknown, callback?: () => void) => Promise<void>
  /** 合并分页与筛选后拉取 */
  filterBy: (pagination: Partial<TicketPagination> | undefined, filter: TicketFilter | undefined) => void
}

export const useTicketManageStore = create<TicketManageState>((set, get) => ({
  tickets: [],
  fetchLoading: false,
  ticket: { message: [] },
  pagination: { pageSize: 10, current: 1 },
  filter: { status: 0 },
  replyLoading: false,

  fetch: async () => {
    const { pagination, filter } = get()
    set({ fetchLoading: true })
    const res = await fetchTickets({ ...pagination, ...filter })
    set({ fetchLoading: false })
    if (res.code !== 200) return
    set({ tickets: res.data ?? [], pagination: { ...pagination, total: res.total } })
  },

  fetchById: async (id) => {
    const res = await fetchTicket(id)
    if (res.code !== 200 || !res.data) return
    set({ ticket: res.data })
    const users = useUserManageStore.getState()
    if (users.user.id) return
    void users.getUserInfoById(res.data.user_id)
  },

  close: async (id) => {
    const res = await closeTicket(id)
    if (res.code !== 200) return
    void get().fetch()
  },

  reply: async (id, msg, callback) => {
    message.loading('发送中')
    set({ replyLoading: true })
    const res = await replyTicket(id, msg)
    set({ replyLoading: false })
    message.destroy()
    if (res.code !== 200) return
    void get().fetchById(id)
    callback?.()
  },

  filterBy: (pagination, filter) => {
    const t = get()
    set({ pagination: { ...t.pagination, ...pagination }, filter: { ...t.filter, ...filter } })
    void get().fetch()
  },
}))
