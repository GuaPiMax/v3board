import { adminPath } from '@/app/settings'
import { get } from '../request'
import type { QueueStats, QueueWorkload } from '../types'

export const getQueueStats = () => get<QueueStats>(adminPath('/system/getQueueStats'))
export const getQueueWorkload = () => get<QueueWorkload[]>(adminPath('/system/getQueueWorkload'))
