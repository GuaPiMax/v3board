import type { NewPeriodLog } from '@/api/types'

/** 订阅覆盖记录里覆盖前的剩余流量（字节）：配额减去已用上下行，不足 0 时按 0（订阅覆盖记录页与订单详情共用） */
export const remainBytes = (snapshot: Pick<NewPeriodLog, 'transfer_enable' | 'u' | 'd'>) =>
  Math.max(0, Number(snapshot.transfer_enable) - Number(snapshot.u) - Number(snapshot.d))
