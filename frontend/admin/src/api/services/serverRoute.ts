import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { ServerRoute } from '../types'

export const fetchServerRoutes = () => get<ServerRoute[]>(adminPath('/server/route/fetch'))
/** 与原版一致：编辑时把整条记录原样提交（created_at 等由后端忽略） */
export const saveServerRoute = (params: Partial<ServerRoute>) => post<boolean>(adminPath('/server/route/save'), params)
export const dropServerRoute = (id: number) => post<boolean>(adminPath('/server/route/drop'), { id })
