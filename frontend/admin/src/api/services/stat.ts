import { adminPath } from '@/app/settings'
import { get } from '../request'
import type { ServerRankItem, StatOrderItem, StatOverride, StatUserRecord, UserRankItem } from '../types'

export const getOverride = () => get<StatOverride>(adminPath('/stat/getOverride'))
export const getOrder = () => get<StatOrderItem[]>(adminPath('/stat/getOrder'))
export const getServerLastRank = () => get<ServerRankItem[]>(adminPath('/stat/getServerLastRank'))
export const getServerTodayRank = () => get<ServerRankItem[]>(adminPath('/stat/getServerTodayRank'))
export const getUserTodayRank = () => get<UserRankItem[]>(adminPath('/stat/getUserTodayRank'))
export const getUserLastRank = () => get<UserRankItem[]>(adminPath('/stat/getUserLastRank'))
/** 用户流量记录：参数为 { user_id, ...pagination }（原版的分页对象） */
export const getStatUser = (params: object) => get<StatUserRecord[]>(adminPath('/stat/getStatUser'), params)
