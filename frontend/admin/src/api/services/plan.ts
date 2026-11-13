import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Plan } from '../types'

export const fetchPlans = () => get<Plan[]>(adminPath('/plan/fetch'))
/** 价格单位为分；与原版一致：编辑时把整条记录原样提交（count 等由后端忽略） */
export const savePlan = (params: object) => post<boolean>(adminPath('/plan/save'), params, true)
export const dropPlan = (id: number) => post<boolean>(adminPath('/plan/drop'), { id })
/** 修改单个字段（销售状态 show / 续费 renew） */
export const updatePlan = (id: number, key: 'show' | 'renew', value: 0 | 1) =>
  post<boolean>(adminPath('/plan/update'), { id, [key]: value })
export const sortPlans = (ids: number[]) => post<boolean>(adminPath('/plan/sort'), { plan_ids: ids })
