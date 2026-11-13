// 用户风险详情（「用户详情」标签页）：按用户 ID 查询评分摘要、最近事件（按小时汇总）、被下发过的节点（每人每节点一行）、审核记录；查到后可直接弹窗审核
import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Tag, type TableColumnsType } from 'antd'
import { useState, type ReactNode } from 'react'
import { unwrap } from '@/api/request'
import { fetchGuardUserDetail } from '@/api/services/insiderGuard'
import type { GuardEvent, GuardReview, GuardUserDetail } from '@/api/types'
import { message } from '@/app/staticApi'
import { Loading } from '@/components/Loading'
import { ReviewModal } from './ReviewModal'
import {
  Ellipsis,
  eventColumns,
  Failed,
  guardKeys,
  guardTime,
  MUTED,
  NodeLabel,
  Note,
  parseUserId,
  REVIEW_ACTION_TEXT,
  Section,
  SubTable,
} from './shared'

const eventTableColumns = eventColumns({ withUser: false, typeTag: false })

type Delivery = GuardUserDetail['deliveries'][number]
const deliveryColumns: TableColumnsType<Delivery> = [
  {
    title: '节点',
    key: 'node',
    render: (_: unknown, row) => <NodeLabel type={row.node_type} id={row.node_id} name={row.node_name} />,
  },
  { title: '下发记录', dataIndex: 'times', key: 'times', width: 100 },
  { title: '首次下发', dataIndex: 'first_at', key: 'first_at', width: 170, render: (s: number) => guardTime(s) },
  { title: '最近下发', dataIndex: 'last_at', key: 'last_at', width: 170, render: (s: number) => guardTime(s) },
]

const reviewColumns: TableColumnsType<GuardReview> = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: (s: number) => guardTime(s) },
  {
    title: '动作',
    dataIndex: 'action',
    key: 'action',
    width: 140,
    render: (action: GuardReview['action']) => REVIEW_ACTION_TEXT[action] ?? action,
  },
  {
    title: '原因',
    dataIndex: 'reason',
    key: 'reason',
    render: (reason: string) => <Ellipsis text={reason} width={360} />,
  },
  { title: '管理员 ID', dataIndex: 'admin_id', key: 'admin_id', width: 100 },
]

/** 评分摘要里的一项 */
function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="pr-4 pr-sm-5" style={{ minWidth: 120 }}>
      <div style={MUTED}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 300 }}>{value}</div>
    </div>
  )
}

interface UserRiskDetailProps {
  /** 挂载时直接查询的用户：风险用户表点「详情」时页面以新 key 重建本组件并传入该用户 */
  initialUserId?: number
  /** 审核保存成功后刷新概览与本组件的查询 */
  onReviewed: () => void
}

export function UserRiskDetail({ initialUserId, onReviewed }: UserRiskDetailProps) {
  const [draft, setDraft] = useState(initialUserId ? String(initialUserId) : '')
  const [userId, setUserId] = useState<number | undefined>(initialUserId)

  const detail = useQuery({
    queryKey: [...guardKeys.userDetail, userId],
    queryFn: () => unwrap(fetchGuardUserDetail(userId as number)),
    enabled: userId !== undefined,
  })

  const search = () => {
    // 只接受纯数字且 ≥ 1 的用户 ID（与「最近事件」一致）
    const id = parseUserId(draft)
    if (id === undefined) {
      message.error('请输入有效的用户 ID')
      return
    }
    // 同一个用户再次点「查询」：重新请求
    if (id === userId) void detail.refetch()
    else setUserId(id)
  }

  const data = detail.data
  return (
    <Section
      extra={
        <>
          <Input
            style={{ width: 160 }}
            placeholder="用户 ID"
            allowClear
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search()
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={detail.isFetching} onClick={search}>
            查询
          </Button>
          {data && (
            <ReviewModal
              user={{
                id: data.user_id,
                email: data.email,
                restricted: data.restriction !== null,
                summary: `最近 1 小时：评分 ${data.risk.score}，订阅 ${data.risk.subscription_requests_1h} 次，IP ${data.risk.distinct_ips_1h} 个`,
              }}
              onSaved={onReviewed}
            >
              <Button>审核此用户</Button>
            </ReviewModal>
          )}
        </>
      }
    >
      {userId === undefined ? (
        <Failed>输入用户 ID 后查询该账号的风险评分、事件与审核记录</Failed>
      ) : (
        <Loading loading={detail.isLoading}>
          {detail.isError && !data && <Failed>查询失败：用户不存在或接口不可用</Failed>}
          {data && (
            <div style={{ paddingBottom: 16 }}>
              <div className="d-flex flex-wrap align-items-center" style={{ gap: 12, marginBottom: 12 }}>
                <span>
                  <span style={MUTED}>邮箱：</span>
                  {data.email}
                </span>
                <span>
                  <span style={MUTED}>用户 ID：</span>#{data.user_id}
                </span>
                <span>
                  <span style={MUTED}>账号状态：</span>
                  {data.banned ? <Tag color="red">已封禁</Tag> : <Tag color="green">正常</Tag>}
                </span>
                <span>
                  <span style={MUTED}>限制状态：</span>
                  {data.restriction ? <Tag color="red">已限制</Tag> : <Tag>未限制</Tag>}
                </span>
              </div>
              {data.restriction && (
                <Note style={{ marginBottom: 12 }}>
                  <div>
                    限制于 {guardTime(data.restriction.created_at)} · 管理员 #{data.restriction.admin_id ?? '-'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>原因：{data.restriction.reason}</div>
                  <div>拉订阅时节点入口为假地址 {data.restriction.decoy_host}</div>
                </Note>
              )}
              <div className="d-flex flex-wrap" style={{ marginBottom: 16 }}>
                <Metric
                  label="评分（最近 1 小时）"
                  value={
                    data.risk.manual_review_required ? <Tag color="orange">{data.risk.score}</Tag> : data.risk.score
                  }
                />
                <Metric label="1 小时订阅次数" value={data.risk.subscription_requests_1h} />
                <Metric label="1 小时 IP 数" value={data.risk.distinct_ips_1h} />
                <Metric label="需人工复核" value={data.risk.manual_review_required ? '是' : '否'} />
              </div>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>最近事件</div>
              <SubTable<GuardEvent> dataSource={data.events} columns={eventTableColumns} scroll={{ x: 830 }} />
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>被下发过的节点</div>
              <SubTable<Delivery>
                rowKey={(row) => `${row.node_type}:${row.node_id}`}
                dataSource={data.deliveries}
                columns={deliveryColumns}
                scroll={{ x: 690 }}
              />
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>审核记录</div>
              <SubTable<GuardReview>
                dataSource={data.reviews}
                columns={reviewColumns}
                scroll={{ x: 770 }}
                style={{ marginBottom: 0 }}
              />
            </div>
          )}
        </Loading>
      )}
    </Section>
  )
}
