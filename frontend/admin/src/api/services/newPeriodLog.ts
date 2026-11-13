import { adminPath } from '@/app/settings'
import { get } from '../request'
import type { NewPeriodLog } from '../types'

/**
 * 提前续期 / 订阅覆盖记录（v3board 独有接口）：参数为 { type, email, trade_no, current, pageSize }，
 * type 为 1 提前续期 / 2 订阅覆盖，email / trade_no 为模糊匹配
 */
export const fetchNewPeriodLogs = (params: object) => get<NewPeriodLog[]>(adminPath('/newPeriodLog/fetch'), params)
