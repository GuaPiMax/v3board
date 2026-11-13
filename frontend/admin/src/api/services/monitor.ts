// Horizon 队列监控接口（不在 /api 下，直接返回对象，没有 data 包装）。
// 必须基于 API 所在的源拼接，前后端分离时不能用 location.origin。
import { apiBase } from '@/app/settings'
import { get } from '../request'

export const fetchHorizonStats = () => get(`${new URL(apiBase).origin}/monitor/api/stats`)
