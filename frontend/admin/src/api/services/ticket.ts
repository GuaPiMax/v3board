import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Ticket, TicketDetail } from '../types'

/** 列表：参数为 { ...pagination, ...filter }（与原版 model ticket 的顺序一致） */
export const fetchTickets = (params: object) => get<Ticket[]>(adminPath('/ticket/fetch'), params)
export const fetchTicket = (id: number | string) => get<TicketDetail>(adminPath('/ticket/fetch'), { id })
export const closeTicket = (id: number) => post<boolean>(adminPath('/ticket/close'), { id })
export const replyTicket = (id: number | string, message: unknown) =>
  post<boolean>(adminPath('/ticket/reply'), { id, message })
