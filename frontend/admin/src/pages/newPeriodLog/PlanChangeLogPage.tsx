import type { TableColumnsType } from 'antd'
import type { NewPeriodLog } from '@/api/types'
import { formatBytes } from '@/utils/format'
import { remainBytes } from './planChange'
import { logTime, NewPeriodLogList } from './shared'

/** 覆盖前剩余时长：原到期时间与覆盖时间之差（一次性订阅显示 -） */
function remainDays(row: NewPeriodLog) {
  if (!row.old_expired_at) return '-'
  const days = (Number(row.old_expired_at) - Number(row.created_at)) / 86400
  return days > 0 ? `${days.toFixed(1)} 天` : '0 天'
}

const columns: TableColumnsType<NewPeriodLog> = [
  { title: '覆盖时间', dataIndex: 'created_at', key: 'created_at', render: (seconds: number) => logTime(seconds) },
  {
    title: '用户邮箱',
    dataIndex: 'user_email',
    key: 'user_email',
    render: (email: string | null | undefined, row) => email || `#${row.user_id}`,
  },
  {
    title: '覆盖前订阅',
    dataIndex: 'plan_name',
    key: 'plan_name',
    render: (name: string | null | undefined) => name || '-',
  },
  {
    title: '覆盖前到期时间',
    dataIndex: 'old_expired_at',
    key: 'old_expired_at',
    render: (seconds: number) => (seconds ? logTime(seconds) : '一次性'),
  },
  { title: '覆盖前剩余时长', key: 'remain_days', render: (_: unknown, row) => remainDays(row) },
  {
    title: '覆盖前剩余/配额',
    key: 'remain_traffic',
    render: (_: unknown, row) => `${formatBytes(remainBytes(row))} / ${formatBytes(row.transfer_enable)}`,
  },
  {
    title: '覆盖后订阅',
    dataIndex: 'new_plan_name',
    key: 'new_plan_name',
    render: (name: string | null | undefined) => name || '-',
  },
  {
    title: '覆盖后到期时间',
    dataIndex: 'new_expired_at',
    key: 'new_expired_at',
    render: (seconds: number) => (seconds ? logTime(seconds) : '一次性'),
  },
  {
    title: '订单号',
    dataIndex: 'trade_no',
    key: 'trade_no',
    render: (tradeNo: string | null | undefined) => (
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{tradeNo || '-'}</span>
    ),
  },
]

// 订阅覆盖记录（v3board 独有）
export default function PlanChangeLogPage() {
  return (
    <NewPeriodLogList
      type={2}
      title="订阅覆盖记录"
      description="购买不同订阅导致原订阅被覆盖时，覆盖前的到期时间与剩余流量快照"
      columns={columns}
      withTradeNo
      minWidth={1100}
    />
  )
}
