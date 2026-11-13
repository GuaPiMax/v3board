import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type {
  GuardCandidates,
  GuardEvent,
  GuardEventType,
  GuardHealth,
  GuardHealthCheckResult,
  GuardHours,
  GuardOverview,
  GuardReviewAction,
  GuardRiskUser,
  GuardTimeline,
  GuardUserDetail,
  NodeType,
} from '../types'

// 风控中心（v3board 独有接口）：GET 用 query，POST 用表单；节点一律用 node_type + node_id 标识
const guardPath = (name: string) => adminPath(`/insiderGuard/${name}`)

/** 概览：近 24 小时事件数、审核总数、限制中账号数、最近 20 条节点异常 */
export const fetchGuardOverview = () => get<GuardOverview>(guardPath('overview'))
/** 风险用户：按时段统计订阅次数与来源 IP 数并评分（响应顶层另有 hours / threshold） */
export const fetchGuardUsers = (hours: GuardHours) => get<GuardRiskUser[]>(guardPath('users'), { hours })
/** 事件列表（服务端分页，顶层 total），可按用户 ID、事件类型筛选 */
export const fetchGuardEvents = (params: {
  current: number
  pageSize: number
  user_id?: number
  event_type?: GuardEventType
}) => get<GuardEvent[]>(guardPath('events'), params)
export const fetchGuardUserDetail = (id: number) => get<GuardUserDetail>(guardPath('userDetail'), { id })
/** 人工审核记录（不改变账号状态）：原因 8～1000 字 */
export const saveGuardReview = (params: { id: number; action: GuardReviewAction; reason: string }) =>
  post<boolean>(guardPath('review'), params)
/** 限制：不封号，之后拉订阅时节点入口换成假地址；原因 12～1000 字，后端要求显式确认 */
export const restrictGuardUser = (params: { id: number; reason: string }) =>
  post<boolean>(guardPath('restrict'), { ...params, confirm: 1 })
/** 解除限制：恢复真实入口；原因 8～1000 字 */
export const releaseGuardUser = (params: { id: number; reason: string }) => post<boolean>(guardPath('release'), params)
/** 登记节点异常：occurred_at 为 unix 秒，reason 1000 字以内 */
export const createNodeIncident = (params: {
  node_type: NodeType
  node_id: number
  occurred_at: number
  reason: string
}) => post<boolean>(guardPath('nodeIncident'), params)
export const fetchIncidentCandidates = (id: number) => get<GuardCandidates>(guardPath('candidates'), { id })
export const fetchIncidentTimeline = (id: number) => get<GuardTimeline>(guardPath('timeline'), { id })
export const fetchGuardHealth = () => get<GuardHealth>(guardPath('health'))
/** 立即探测一个节点的 TCP 连通性（后端限流 10 次 / 分钟） */
export const checkNodeHealth = (params: { node_type: NodeType; node_id: number }) =>
  post<GuardHealthCheckResult>(guardPath('healthCheck'), params)
