// 节点异常及候选账号（独占一个标签页）：每条异常一张小卡片（可展开候选账号 / 时间线），下方可折叠的「登记节点异常」表单
import { useQuery } from '@tanstack/react-query'
import { Button, DatePicker, Input, Tag, type TableColumnsType } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { unwrap } from '@/api/request'
import { createNodeIncident, fetchIncidentCandidates, fetchIncidentTimeline } from '@/api/services/insiderGuard'
import type { GuardCandidates, GuardHealthRecord, GuardIncident, GuardTimeline } from '@/api/types'
import { message } from '@/app/staticApi'
import { Loading } from '@/components/Loading'
import { NodeSelect } from '@/components/NodeSelect'
import { paginationProps } from '@/hooks/usePagedList'
import { useUi } from '@/stores/appearance'
import { parseNodeKey } from '@/utils/nodes'
import { Ellipsis, Failed, guardKeys, guardTime, MUTED, NodeLabel, Note, Section, SubTable, userLabel } from './shared'

interface NodeIncidentsProps {
  incidents: GuardIncident[]
  loading?: boolean
  /** 概览请求失败 */
  failed?: boolean
  /** 登记成功后刷新概览 */
  onChanged: () => void
}

export function NodeIncidents({ incidents, loading, failed, onChanged }: NodeIncidentsProps) {
  return (
    <Section>
      <Note style={{ marginBottom: 12 }}>
        候选账号仅表示异常前 24 小时内被下发过该节点（按首次 / 最近下发时间估算），不代表泄露该节点。
      </Note>
      <Loading loading={loading}>
        {failed ? (
          <Failed>读取失败：节点异常记录暂时无法加载，请刷新页面重试</Failed>
        ) : incidents.length === 0 ? (
          <Failed>暂无节点异常记录</Failed>
        ) : (
          <div className="row">
            {incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        )}
      </Loading>
      <IncidentForm onCreated={onChanged} />
    </Section>
  )
}

type Panel = 'none' | 'candidates' | 'timeline'

function IncidentCard({ incident }: { incident: GuardIncident }) {
  const [panel, setPanel] = useState<Panel>('none')
  const toggle = (next: Panel) => setPanel((current) => (current === next ? 'none' : next))
  return (
    <div className="col-lg-6">
      <div className="block block-bordered block-rounded mb-3">
        <div className="block-content block-content-full">
          <div className="d-flex justify-content-between align-items-start flex-wrap" style={{ gap: 8 }}>
            <div>
              <div style={{ marginBottom: 6 }}>
                <NodeLabel type={incident.node_type} id={incident.node_id} name={incident.node_name} />
              </div>
              <div style={MUTED}>发生时间：{guardTime(incident.occurred_at)}</div>
              <div style={MUTED}>
                登记：{guardTime(incident.created_at)} · 管理员 #{incident.admin_id}
              </div>
            </div>
            <div className="d-flex" style={{ gap: 8 }}>
              <Button
                size="small"
                type={panel === 'candidates' ? 'primary' : 'default'}
                onClick={() => toggle('candidates')}
              >
                查看候选账号
              </Button>
              <Button
                size="small"
                type={panel === 'timeline' ? 'primary' : 'default'}
                onClick={() => toggle('timeline')}
              >
                时间线
              </Button>
            </div>
          </div>
          <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{incident.reason}</div>
          {panel === 'candidates' && <Candidates incidentId={incident.id} />}
          {panel === 'timeline' && <Timeline incidentId={incident.id} />}
        </div>
      </div>
    </div>
  )
}

type Candidate = GuardCandidates['candidates'][number]
const candidateColumns: TableColumnsType<Candidate> = [
  { title: '账号', key: 'user', render: (_: unknown, row) => userLabel(row.email, row.user_id) },
  { title: '下发记录', dataIndex: 'times', key: 'times', width: 90 },
  { title: '首次下发', dataIndex: 'first_at', key: 'first_at', width: 170, render: (s: number) => guardTime(s) },
  { title: '最近下发', dataIndex: 'last_at', key: 'last_at', width: 170, render: (s: number) => guardTime(s) },
]

/** 候选账号：异常前 24 小时内被下发过该节点的账号，每人一行（点开时才请求） */
function Candidates({ incidentId }: { incidentId: number }) {
  const query = useQuery({
    queryKey: guardKeys.candidates(incidentId),
    queryFn: () => unwrap(fetchIncidentCandidates(incidentId)),
  })
  // 收起时本组件卸载、再点开重新挂载并重新请求，所以失败后提示「收起后再点开」；读到过数据时照常显示
  if (query.isError && !query.data) {
    return <Failed>读取失败：候选账号暂时无法加载，收起后再点开重试</Failed>
  }
  return (
    <div style={{ marginTop: 12 }}>
      <SubTable<Candidate>
        rowKey="user_id"
        loading={query.isLoading}
        dataSource={query.data?.candidates ?? []}
        columns={candidateColumns}
        scroll={{ x: 560 }}
        style={{ marginBottom: 8 }}
      />
      {query.data && <Note>{query.data.caveat}</Note>}
    </div>
  )
}

const healthColumns: TableColumnsType<GuardHealthRecord> = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: (s: number) => guardTime(s) },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (status: GuardHealthRecord['status']) =>
      status === 'up' ? <Tag color="green">up</Tag> : <Tag color="red">down</Tag>,
  },
  { title: '延迟', dataIndex: 'latency_ms', key: 'latency_ms', width: 90, render: (ms: number) => `${ms} ms` },
  {
    title: '错误',
    dataIndex: 'error',
    key: 'error',
    render: (error: string | null) => <Ellipsis text={error} width={200} />,
  },
]

type Delivery = GuardTimeline['deliveries'][number]
const deliveryColumns: TableColumnsType<Delivery> = [
  { title: '首次下发', dataIndex: 'first_at', key: 'first_at', width: 170, render: (s: number) => guardTime(s) },
  { title: '最近下发', dataIndex: 'last_at', key: 'last_at', width: 170, render: (s: number) => guardTime(s) },
  { title: '账号', key: 'user', render: (_: unknown, row) => userLabel(row.email, row.user_id) },
  { title: '下发记录', dataIndex: 'times', key: 'times', width: 90 },
]

/** 下发账号的小标题：列表最多 500 行，不够全部显示时标出「显示 N / 共 M」 */
function deliveriesSummary(data: GuardTimeline | undefined) {
  const shown = data?.deliveries.length ?? 0
  const total = data?.deliveries_total ?? shown
  return shown === total ? `共 ${total} 个账号` : `显示 ${shown} / 共 ${total} 个账号`
}

/** 时间线：异常前 24 小时到后 6 小时的健康探测与下发记录概览 */
function Timeline({ incidentId }: { incidentId: number }) {
  const ui = useUi()
  const query = useQuery({
    queryKey: guardKeys.timeline(incidentId),
    queryFn: () => unwrap(fetchIncidentTimeline(incidentId)),
  })
  const data = query.data
  const down = data?.health.filter((h) => h.status === 'down').length ?? 0
  // 同候选账号：收起再点开会重新请求；读到过数据时照常显示
  if (query.isError && !data) {
    return <Failed>读取失败：时间线暂时无法加载，收起后再点开重试</Failed>
  }
  return (
    <Loading loading={query.isLoading}>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 6 }}>
          健康探测{' '}
          <span style={MUTED}>
            共 {data?.health.length ?? 0} 条，其中 down {down} 条
          </span>
        </div>
        <SubTable<GuardHealthRecord>
          dataSource={data?.health ?? []}
          columns={healthColumns}
          scroll={{ x: 540 }}
          pagination={{ ...paginationProps(ui), defaultPageSize: 20, hideOnSinglePage: true }}
          style={{ marginBottom: 12 }}
        />
        <div style={{ fontWeight: 'bold', marginBottom: 6 }}>
          订阅下发 <span style={MUTED}>{deliveriesSummary(data)}</span>
        </div>
        <Note style={{ marginBottom: 6 }}>按首次 / 最近下发时间估算在该时段内被下发过该节点的账号，每人一行。</Note>
        <SubTable<Delivery>
          rowKey="user_id"
          dataSource={data?.deliveries ?? []}
          columns={deliveryColumns}
          scroll={{ x: 560 }}
          pagination={{ ...paginationProps(ui), defaultPageSize: 20, hideOnSinglePage: true }}
          style={{ marginBottom: 8 }}
        />
        {data && <Note>{data.disclaimer}</Note>}
      </div>
    </Loading>
  )
}

/** 登记节点异常（可折叠）：节点、发生时间（提交 unix 秒）、异常描述 */
function IncidentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [node, setNode] = useState<string>()
  // 发生时间默认为第一次展开表单时的当前时间（折叠着的时候不提前固定；选过的时间收起再展开不覆盖）
  const [time, setTime] = useState<Dayjs | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!node) return message.error('请选择节点')
    if (!time) return message.error('请选择发生时间')
    const text = reason.trim()
    if (!text) return message.error('请填写异常描述')
    if ([...text].length > 1000) return message.error('异常描述不能超过 1000 字')
    const { type, id } = parseNodeKey(node)
    setSaving(true)
    const res = await createNodeIncident({ node_type: type, node_id: id, occurred_at: time.unix(), reason: text })
    setSaving(false)
    if (res.code !== 200 || res.data !== true) return
    message.success('节点异常已登记')
    setReason('')
    onCreated()
  }

  return (
    <div style={{ borderTop: '1px solid var(--v2b-line-soft, #eee)', paddingTop: 12, marginBottom: 16 }}>
      <Button
        size="small"
        onClick={() => {
          if (!open && time === null) setTime(dayjs())
          setOpen(!open)
        }}
      >
        {open ? '收起' : '登记节点异常'}
      </Button>
      {open && (
        <div style={{ marginTop: 12, maxWidth: 640 }}>
          <div className="d-flex flex-wrap" style={{ gap: 8, marginBottom: 8 }}>
            <NodeSelect value={node} onChange={setNode} />
            <DatePicker showTime placeholder="发生时间" value={time} onChange={(value) => setTime(value)} />
          </div>
          <Input.TextArea
            rows={3}
            placeholder="异常描述，例如：节点在某地区被封，1000 字以内"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Button type="primary" loading={saving} onClick={() => void submit()}>
            提交
          </Button>
        </div>
      )}
    </div>
  )
}
