import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { ServerGroup } from '../types'

export const fetchServerGroups = () => get<ServerGroup[]>(adminPath('/server/group/fetch'))
/** 与原版一致：编辑时把整条记录原样提交（user_count 等由后端忽略） */
export const saveServerGroup = (params: Partial<ServerGroup>) => post<boolean>(adminPath('/server/group/save'), params)
export const dropServerGroup = (id: number) => post<boolean>(adminPath('/server/group/drop'), { id })
