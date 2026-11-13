// 队列监控的数据（原版 dva model system，模块 gENZ）：全局状态，回到页面时先显示上次的数据
import { create } from 'zustand'
import { getQueueStats, getQueueWorkload } from '@/api/services/system'
import type { QueueStats, QueueWorkload } from '@/api/types'

interface QueueMonitorState {
  queueStats?: QueueStats
  queueWorkload?: QueueWorkload[]
  getQueueStats: () => Promise<void>
  getQueueWorkload: () => Promise<void>
}

export const useQueueMonitorStore = create<QueueMonitorState>((set) => ({
  getQueueStats: async () => {
    const res = await getQueueStats()
    if (res.code === 200) set({ queueStats: res.data })
  },
  getQueueWorkload: async () => {
    const res = await getQueueWorkload()
    if (res.code === 200) set({ queueWorkload: res.data })
  },
}))
