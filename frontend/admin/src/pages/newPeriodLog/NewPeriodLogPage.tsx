import type { TableColumnsType } from 'antd'
import type { NewPeriodLog } from '@/api/types'
import { formatBytes } from '@/utils/format'
import { logTime, NewPeriodLogList } from './shared'

const columns: TableColumnsType<NewPeriodLog> = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (seconds: number) => logTime(seconds) },
  {
    title: '用户邮箱',
    dataIndex: 'user_email',
    key: 'user_email',
    render: (email: string | null | undefined, row) => email || `#${row.user_id}`,
  },
  { title: '套餐', dataIndex: 'plan_name', key: 'plan_name', render: (name: string | null | undefined) => name || '-' },
  { title: '扣除天数', dataIndex: 'deduct_days', key: 'deduct_days', render: (days: number) => `${days} 天` },
  {
    title: '原到期时间',
    dataIndex: 'old_expired_at',
    key: 'old_expired_at',
    render: (seconds: number) => logTime(seconds),
  },
  {
    title: '新到期时间',
    dataIndex: 'new_expired_at',
    key: 'new_expired_at',
    render: (seconds: number) => logTime(seconds),
  },
  {
    title: '重置前已用/配额',
    key: 'usage',
    render: (_: unknown, row) => `${formatBytes(Number(row.u) + Number(row.d))} / ${formatBytes(row.transfer_enable)}`,
  },
]

// 提前续期记录（v3board 独有）
export default function NewPeriodLogPage() {
  return (
    <NewPeriodLogList
      type={1}
      title="提前续期记录"
      description="用户流量用尽后提前开启下一计费周期（扣除订阅时长重置流量）的操作记录"
      columns={columns}
      minWidth={860}
    />
  )
}
