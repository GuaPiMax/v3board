// 节点健康检查（TCP，独占一个标签页）：立即探测一个节点，或查看定时任务的最近探测记录
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Tag, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { unwrap } from '@/api/request'
import { checkNodeHealth, fetchGuardHealth } from '@/api/services/insiderGuard'
import type { GuardHealthCheckResult, GuardHealthRecord } from '@/api/types'
import { message } from '@/app/staticApi'
import { Loading } from '@/components/Loading'
import { NodeSelect } from '@/components/NodeSelect'
import { paginationProps } from '@/hooks/usePagedList'
import { useUi } from '@/stores/appearance'
import { parseNodeKey } from '@/utils/nodes'
import { Ellipsis, Failed, guardKeys, guardTime, MUTED, NodeLabel, Note, Section, SubTable } from './shared'

const columns: TableColumnsType<GuardHealthRecord> = [
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: (s: number) => guardTime(s) },
  {
    title: '节点',
    key: 'node',
    render: (_: unknown, row) => <NodeLabel type={row.node_type} id={row.node_id} name={row.node_name} />,
  },
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
    render: (error: string | null) => <Ellipsis text={error} width={320} />,
  },
]

/** 立即探测的结果：状态标签 + 延迟 / 错误 / 说明 */
const RESULT_TAG: Record<GuardHealthCheckResult['status'], { color?: string; text: string }> = {
  up: { color: 'green', text: 'up · TCP 连通' },
  down: { color: 'red', text: 'down · TCP 不通' },
  skipped: { text: '已跳过' },
  disabled: { color: 'orange', text: '未开启' },
  error: { color: 'red', text: '出错' },
}

function CheckResult({ result }: { result: GuardHealthCheckResult }) {
  const tag = RESULT_TAG[result.status] ?? { text: result.status }
  return (
    <div style={{ marginBottom: 12 }}>
      <Tag color={tag.color}>{tag.text}</Tag>
      {result.name && <span style={{ marginRight: 8 }}>{result.name}</span>}
      <span style={MUTED}>
        {result.node_type}#{result.node_id}
        {result.latency_ms !== undefined && ` · ${result.latency_ms} ms`}
        {result.error && ` · ${result.error}`}
        {result.message && ` · ${result.message}`}
      </span>
    </div>
  )
}

interface NodeHealthProps {
  /** 健康检查未开启时的提示里「前往设置」：切到「风控设置」标签页 */
  onOpenSettings: () => void
}

export function NodeHealth({ onOpenSettings }: NodeHealthProps) {
  const ui = useUi()
  // 标签页内容按需挂载：第一次切到「节点健康」时才请求，「刷新」重新拉取
  const health = useQuery({ queryKey: guardKeys.health, queryFn: () => unwrap(fetchGuardHealth()) })
  const [node, setNode] = useState<string>()
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<GuardHealthCheckResult>()

  const check = async () => {
    if (!node) return
    const { type, id } = parseNodeKey(node)
    setChecking(true)
    setResult(undefined)
    const res = await checkNodeHealth({ node_type: type, node_id: id })
    setChecking(false)
    // 后端限流 10 次 / 分钟：429 时请求层只弹通用提示，这里补一条具体说明
    if (res.code === 429) {
      message.error('检测过于频繁，每分钟最多 10 次，请稍后再试')
      return
    }
    if (res.code !== 200 || !res.data) return
    setResult(res.data)
    // 探测到 up / down 时后端会写一条记录：刷新下方的最近探测记录
    if (res.data.status === 'up' || res.data.status === 'down') void health.refetch()
  }

  return (
    <Section
      extra={
        <>
          <NodeSelect value={node} onChange={setNode} />
          <Button type="primary" disabled={!node} loading={checking} onClick={() => void check()}>
            立即检测此节点 TCP
          </Button>
          <Button icon={<ReloadOutlined />} loading={health.isFetching} onClick={() => void health.refetch()}>
            刷新
          </Button>
        </>
      }
    >
      <Note style={{ marginBottom: 12 }}>UDP/QUIC 节点不会用 TCP 检测，TCP 不通也不代表 IP 被封。</Note>
      {result && <CheckResult result={result} />}
      <Loading loading={health.isLoading}>
        {/* 首次加载时给加载动画留出高度，避免压到上面的说明文字 */}
        {!health.data && !health.isError && <div style={{ minHeight: 120 }} />}
        {health.isError && !health.data && <Failed>读取失败：最近探测记录暂时无法加载，请点「刷新」重试</Failed>}
        {health.data && (
          <>
            {!health.data.enabled && (
              <div className="alert alert-warning" role="alert" style={{ marginBottom: 12 }}>
                <p className="mb-0">
                  节点健康检查未开启，定时探测不会运行；请先在「风控设置」里开启。
                  <Button
                    type="link"
                    size="small"
                    onClick={(e) => {
                      // V2Tabs 对非活动面板加了 inert，浏览器会自动移走焦点；旧浏览器不支持时靠这里 blur
                      e.currentTarget.blur()
                      onOpenSettings()
                    }}
                  >
                    前往设置
                  </Button>
                </p>
              </div>
            )}
            <SubTable<GuardHealthRecord>
              dataSource={health.data.records}
              columns={columns}
              scroll={{ x: 800 }}
              pagination={{ ...paginationProps(ui), defaultPageSize: 20, hideOnSinglePage: true }}
              style={{ marginBottom: 8 }}
            />
            <Note style={{ marginBottom: 16 }}>{health.data.note}</Note>
          </>
        )}
      </Loading>
    </Section>
  )
}
