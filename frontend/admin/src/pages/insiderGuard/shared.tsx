// 风控中心（v3board 独有）各分区共用的部分：查询 key、用户 ID 解析、节点标签、UA 省略显示、汇总事件的时间列、分区容器与说明文字
import { useQuery } from '@tanstack/react-query'
import { Tag, Tooltip, type TableColumnsType, type TableProps } from 'antd'
import dayjs from 'dayjs'
import type { CSSProperties, ReactNode } from 'react'
import { unwrap } from '@/api/request'
import { fetchGuardUsers } from '@/api/services/insiderGuard'
import type { GuardEvent, GuardEventType, GuardHours, GuardReviewAction } from '@/api/types'
import { V2Table } from '@/components/table/V2Table'
import { formatTime } from '@/utils/format'
import { typeBadge } from '@/utils/nodes'

const USERS_KEY = ['insiderGuard', 'users'] as const

export const guardKeys = {
  overview: ['insiderGuard', 'overview'],
  /** 所有时段的风险用户列表（前缀）：限制 / 解除、改阈值后整体失效 */
  usersAll: USERS_KEY,
  users: (hours: GuardHours) => [...USERS_KEY, hours] as const,
  events: ['insiderGuard', 'events'],
  userDetail: ['insiderGuard', 'userDetail'],
  candidates: (incidentId: number) => ['insiderGuard', 'candidates', incidentId] as const,
  timeline: (incidentId: number) => ['insiderGuard', 'timeline', incidentId] as const,
  health: ['insiderGuard', 'health'],
  config: ['config', 'insider_guard'],
} as const

/** 用户 ID 输入框的值：只接受纯数字且 ≥ 1，其它返回 undefined */
export function parseUserId(text: string): number | undefined {
  const value = text.trim()
  if (!/^\d+$/.test(value)) return undefined
  const id = Number(value)
  return id >= 1 && Number.isSafeInteger(id) ? id : undefined
}

/** 风险用户列表：统计卡片与风险用户表共用同一个查询（同 key 只发一个请求） */
export function useGuardUsers(hours: GuardHours) {
  return useQuery({ queryKey: guardKeys.users(hours), queryFn: () => unwrap(fetchGuardUsers(hours)) })
}

export const HOURS_OPTIONS: Array<{ value: GuardHours; label: string }> = [
  { value: 1, label: '最近 1 小时' },
  { value: 8, label: '最近 8 小时' },
  { value: 24, label: '最近 24 小时' },
  { value: 72, label: '最近 72 小时' },
  { value: 168, label: '最近 7 天' },
]

/** 时段下拉的文案，例如「最近 1 小时」 */
export const hoursLabel = (hours: GuardHours) => HOURS_OPTIONS.find((o) => o.value === hours)?.label ?? ''

export const EVENT_TYPE_TEXT: Record<GuardEventType, string> = { login: '登录', subscription: '订阅' }

export const REVIEW_ACTION_TEXT: Record<GuardReviewAction, string> = {
  watch: '持续观察',
  clear: '解除疑虑',
  restrict_recommended: '建议限制',
  restrict: '限制（下发假入口）',
  release: '解除限制',
}

/** unix 秒 → YYYY-MM-DD HH:mm:ss，空值显示 - */
export const guardTime = (seconds: number | null | undefined) =>
  seconds ? formatTime(seconds, 'YYYY-MM-DD HH:mm:ss') : '-'

/** 用户：邮箱，没有邮箱（已删除）时显示 #id */
export const userLabel = (email: string | null | undefined, userId: number | null | undefined) =>
  email || (userId ? `#${userId}` : '-')

export const MUTED: CSSProperties = { fontSize: 12, color: 'var(--v2b-text-muted, #666)' }

/** 分区下方 / 控件旁的灰色小字说明 */
export function Note({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...MUTED, ...style }}>{children}</div>
}

/** 表格 / 卡片位置上的占位文字：读取失败、暂无数据、还没查询 */
export function Failed({ children }: { children: ReactNode }) {
  return <div style={{ ...MUTED, padding: '12px 0 16px' }}>{children}</div>
}

/**
 * 按小时汇总的事件的时间列：显示该小时内最近一次；合并了多次时在下方用小字标出首次时间
 * （与最近一次同一天时只显示时分秒，跨天时带月日；首次时间为 0 / 空时显示 -）
 */
export function EventTime({ event }: { event: Pick<GuardEvent, 'times' | 'first_at' | 'last_at'> }) {
  const sameDay = dayjs(event.first_at * 1000).isSame(event.last_at * 1000, 'day')
  return (
    <>
      {guardTime(event.last_at)}
      {event.times > 1 && (
        <div style={MUTED}>
          首次 {event.first_at ? formatTime(event.first_at, sameDay ? 'HH:mm:ss' : 'MM-DD HH:mm:ss') : '-'}
        </div>
      )}
    </>
  )
}

/** UA 为空（请求没带 UA）时的文案；ua_hash 非空但字典里查不到文本时显示 UA_UNKNOWN */
export const UA_EMPTY = '未提供'
export const UA_UNKNOWN = '未知（字典缺失）'

/**
 * 溢出桶：同一用户同一小时内的（类型、IP、UA）桶数超限后，后续记录并入 IP 为空、UA 为 null 的一行；
 * 事件表的 IP 列显示「已合并」，UA 列显示 UA_MERGED
 */
export const isMergedBucket = (row: Pick<GuardEvent, 'ip_address'>) => row.ip_address === ''
export const UA_MERGED = '同一小时桶数超限，已合并'

/**
 * 事件表的列（「最近事件」与「用户详情」共用）：时间（含首次）、[用户]、类型、IP、UA、次数、节点数。
 * withUser：是否带「用户」列；typeTag：类型是否用 Tag 显示（订阅为蓝色）
 */
export function eventColumns({
  withUser,
  typeTag,
}: {
  withUser: boolean
  typeTag: boolean
}): TableColumnsType<GuardEvent> {
  return [
    { title: '时间', key: 'time', width: 170, render: (_: unknown, row) => <EventTime event={row} /> },
    ...(withUser
      ? [{ title: '用户', key: 'user', render: (_: unknown, row: GuardEvent) => userLabel(row.email, row.user_id) }]
      : []),
    {
      title: '类型',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 80,
      render: (type: GuardEventType) => {
        const text = EVENT_TYPE_TEXT[type] ?? type
        return typeTag ? <Tag color={type === 'subscription' ? 'blue' : undefined}>{text}</Tag> : text
      },
    },
    // 溢出桶：IP 列显示「已合并」，UA 列显示合并说明；正常行不变
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      render: (ip: string, row) => (isMergedBucket(row) ? '已合并' : ip || '-'),
    },
    {
      title: 'UA',
      dataIndex: 'ua',
      key: 'ua',
      render: (ua: string | null, row) =>
        isMergedBucket(row) ? (
          <span style={MUTED}>{UA_MERGED}</span>
        ) : (
          <Ellipsis text={ua} width={260} empty={row.ua_hash === '' ? UA_EMPTY : UA_UNKNOWN} />
        ),
    },
    { title: '次数', dataIndex: 'times', key: 'times', width: 70 },
    {
      title: '节点数',
      dataIndex: 'node_count',
      key: 'node_count',
      width: 80,
      render: (n: number | null, row) => (row.event_type === 'subscription' && n != null ? n : '-'),
    },
  ]
}

/** UA 等长文本：单行省略，悬停看全文；空值显示 empty（默认 -） */
export function Ellipsis({
  text,
  width = 240,
  empty = '-',
}: {
  text: string | null | undefined
  width?: number
  empty?: string
}) {
  if (!text) return <>{empty}</>
  return (
    <Tooltip placement="topLeft" title={text}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: width,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          verticalAlign: 'bottom',
        }}
      >
        {text}
      </span>
    </Tooltip>
  )
}

/** 节点：协议徽标 + 名称 + #id（名称解析不到时只显示 #id） */
export function NodeLabel({ type, id, name }: { type: string; id: number; name?: string | null }) {
  return (
    <span>
      <Tag style={{ marginRight: 6 }}>{typeBadge(type)}</Tag>
      {name ? `${name} ` : ''}
      <span style={MUTED}>#{id}</span>
    </span>
  )
}

interface SectionProps {
  /** 分区标题；一个标签页里只有一个分区时不传，避免与标签名重复 */
  title?: ReactNode
  /** 标题右侧的控件（没有标题时靠左） */
  extra?: ReactNode
  children: ReactNode
}

/** 标签页里的分区：标题行（标题 + 控件）+ 内容。页面本身已是一个 block，这里不再嵌套卡片 */
export function Section({ title, extra, children }: SectionProps) {
  return (
    <div>
      {(title || extra) && (
        <div className="d-flex align-items-center flex-wrap" style={{ gap: 8, marginBottom: 12 }}>
          {title && (
            <h3 className="block-title" style={{ fontSize: 15 }}>
              {title}
            </h3>
          )}
          {extra && (
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
              {extra}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

/** 分区里的小表格：紧凑、默认不分页 */
export function SubTable<T extends object>(props: TableProps<T>) {
  return <V2Table<T> size="small" pagination={false} style={{ marginBottom: 16 }} {...props} />
}
