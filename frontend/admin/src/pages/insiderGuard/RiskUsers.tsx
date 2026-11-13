// 风险用户（「概览」标签页）：按时段统计每个用户的订阅次数与来源 IP 数并评分；「详情」切到「用户详情」标签页，「审核」弹窗记审核 / 限制 / 解除限制
import { ReloadOutlined } from '@ant-design/icons'
import { Button, Select, Tag, type TableColumnsType } from 'antd'
import type { GuardHours, GuardRiskUser } from '@/api/types'
import { paginationProps } from '@/hooks/usePagedList'
import { useUi } from '@/stores/appearance'
import { ReviewModal } from './ReviewModal'
import {
  Ellipsis,
  Failed,
  guardTime,
  HOURS_OPTIONS,
  hoursLabel,
  MUTED,
  Note,
  Section,
  SubTable,
  UA_EMPTY,
  useGuardUsers,
} from './shared'

interface RiskUsersProps {
  hours: GuardHours
  onHoursChange: (hours: GuardHours) => void
  /** 「详情」：切到「用户详情」标签页查询该用户 */
  onDetail: (userId: number) => void
  /** 审核保存成功后刷新概览与用户详情 */
  onReviewed: () => void
}

export function RiskUsers({ hours, onHoursChange, onDetail, onReviewed }: RiskUsersProps) {
  const ui = useUi()
  const users = useGuardUsers(hours)

  const columns: TableColumnsType<GuardRiskUser> = [
    { title: '用户 ID', dataIndex: 'user_id', key: 'user_id', width: 90 },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email: string | null, row) => (
        <>
          {email || <span style={MUTED}>已删除</span>}
          {row.restricted && (
            <Tag color="red" style={{ marginLeft: 6 }}>
              已限制
            </Tag>
          )}
        </>
      ),
    },
    {
      title: '最近 UA',
      dataIndex: 'ua',
      key: 'ua',
      render: (ua: string | null) => <Ellipsis text={ua} width={220} empty={UA_EMPTY} />,
    },
    { title: '订阅次数', dataIndex: 'pulls', key: 'pulls', width: 100 },
    { title: 'IP 数', dataIndex: 'ips', key: 'ips', width: 80 },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      width: 90,
      render: (score: number, row) => (row.high_risk ? <Tag color="orange">{score}</Tag> : <Tag>{score}</Tag>),
    },
    { title: '最近活动', dataIndex: 'last_seen', key: 'last_seen', width: 170, render: (s: number) => guardTime(s) },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, row) => (
        <div className="d-flex" style={{ gap: 8 }}>
          <Button size="small" onClick={() => onDetail(row.user_id)}>
            详情
          </Button>
          <ReviewModal
            user={{
              id: row.user_id,
              email: row.email,
              restricted: row.restricted,
              summary: `${hoursLabel(hours)}：评分 ${row.score}，订阅 ${row.pulls} 次，IP ${row.ips} 个`,
            }}
            onSaved={onReviewed}
          >
            <Button size="small">审核</Button>
          </ReviewModal>
        </div>
      ),
    },
  ]

  return (
    <Section
      title="风险用户"
      extra={
        <>
          <Select<GuardHours> style={{ width: 150 }} value={hours} options={HOURS_OPTIONS} onChange={onHoursChange} />
          <Button icon={<ReloadOutlined />} loading={users.isFetching} onClick={() => void users.refetch()}>
            刷新
          </Button>
        </>
      }
    >
      {users.isError && !users.data ? (
        // 读到过数据、刷新失败：下面照常显示上次的表格
        <Failed>读取失败：风险用户列表暂时无法加载，请点「刷新」重试</Failed>
      ) : (
        // 后端最多返回 500 行：前端分页，每页 20
        <SubTable<GuardRiskUser>
          rowKey="user_id"
          loading={users.isLoading}
          dataSource={users.data ?? []}
          columns={columns}
          scroll={{ x: 900 }}
          pagination={{ ...paginationProps(ui), defaultPageSize: 20, hideOnSinglePage: true }}
          style={{ marginBottom: 8 }}
        />
      )}
      <Note style={{ marginBottom: 16 }}>当前评分只覆盖订阅次数和来源 IP 数；不能证明用户恶意行为。</Note>
    </Section>
  )
}
