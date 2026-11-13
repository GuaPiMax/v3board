import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { NodeSortPayload } from '@/pages/server/manage/utils'
import type { NodeType, ServerNode } from '../types'

export const fetchNodes = () => get<ServerNode[]>(adminPath('/server/manage/getNodes'))
/** 与原版一致：以 JSON 提交（唯一一个 JSON 请求） */
export const sortNodes = (payload: NodeSortPayload) => post<boolean>(adminPath('/server/manage/sort'), payload, true)

// 各协议的增删改接口路径相同，只有 /server/<type>/ 不同（原版 serverVmess、serverTrojan 等 model 的逻辑完全一样）
/** 与原版一致：把表单里的整条记录原样提交 */
export const saveNode = (type: NodeType, params: object) => post<boolean>(adminPath(`/server/${type}/save`), params)
/** 修改单个字段（列表里的显隐开关） */
export const updateNode = (type: NodeType, id: number, key: string, value: unknown) =>
  post<boolean>(adminPath(`/server/${type}/update`), { id, [key]: value })
export const dropNode = (type: NodeType, id: number) => post<boolean>(adminPath(`/server/${type}/drop`), { id })
export const copyNode = (type: NodeType, id: number) => post<boolean>(adminPath(`/server/${type}/copy`), { id })
