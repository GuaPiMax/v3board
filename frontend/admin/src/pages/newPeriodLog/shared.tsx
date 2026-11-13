// 提前续期记录 / 订阅覆盖记录（v3board 独有，后端 newPeriodLog/fetch）共用的列表页：
//   - 顶部左侧标题与说明，右侧搜索框（邮箱，订阅覆盖记录另有订单号）、「搜索」「刷新」
//   - 用户管理「TA的提前续期记录 / 订阅覆盖记录」、订单管理「覆盖记录」跳过来时，地址栏带 email / trade_no 预填并筛选
//   - 输入框内容与已生效的筛选分开：点「搜索」或回车才生效
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Input, type TableColumnsType, type TablePaginationConfig } from 'antd'
import { useState, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router'
import { ApiError } from '@/api/request'
import { fetchNewPeriodLogs } from '@/api/services/newPeriodLog'
import type { NewPeriodLog } from '@/api/types'
import { TableBlock } from '@/components/TableBlock'
import { V2Table } from '@/components/table/V2Table'
import { paginationProps } from '@/hooks/usePagedList'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useUi } from '@/stores/appearance'
import { formatTime } from '@/utils/format'

/** 记录类型：1 提前续期 / 2 订阅覆盖 */
type LogType = 1 | 2

interface LogFilter {
  email: string
  trade_no: string
}

/** 地址栏里的筛选参数（hash 路由：#/newPeriodLog?email=xxx） */
function filterFromSearch(search: string): LogFilter {
  const params = new URLSearchParams(search)
  return { email: params.get('email') ?? '', trade_no: params.get('trade_no') ?? '' }
}

/** unix 秒 → YYYY-MM-DD HH:mm，空值显示 - */
export const logTime = (seconds: number | null | undefined) => (seconds ? formatTime(seconds, 'YYYY-MM-DD HH:mm') : '-')

interface NewPeriodLogListProps {
  type: LogType
  title: string
  description: string
  columns: TableColumnsType<NewPeriodLog>
  /** 另提供订单号搜索（订阅覆盖记录） */
  withTradeNo?: boolean
  /** 表格最小宽度，不够时横向滚动 */
  minWidth: number
}

export function NewPeriodLogList(props: NewPeriodLogListProps) {
  const location = useLocation()
  return (
    <AdminLayout title={props.title}>
      {/* 停留在本页时切换到另一个用户 / 订单（地址栏参数变化）：按新参数重建表格区域（输入框、筛选、页码都回到初始），页面布局不重建 */}
      <LogList key={location.search} initial={filterFromSearch(location.search)} {...props} />
    </AdminLayout>
  )
}

function LogList({
  type,
  title,
  description,
  columns,
  withTradeNo = false,
  minWidth,
  initial,
}: NewPeriodLogListProps & { initial: LogFilter }) {
  const ui = useUi()
  const [draft, setDraft] = useState<LogFilter>(initial)
  const [filter, setFilter] = useState<LogFilter>(initial)
  const [page, setPage] = useState({ current: 1, pageSize: 20 })

  const query = useQuery({
    queryKey: ['newPeriodLog', type, filter, page],
    queryFn: async () => {
      const res = await fetchNewPeriodLogs({
        type,
        email: filter.email || undefined,
        trade_no: filter.trade_no || undefined,
        ...page,
      })
      if (res.code !== 200) throw new ApiError(res.code, res.msg)
      return { rows: res.data ?? [], total: res.total ?? 0 }
    },
    placeholderData: keepPreviousData,
  })

  const search = () => {
    setFilter({ email: draft.email.trim(), trade_no: draft.trade_no.trim() })
    setPage((p) => ({ ...p, current: 1 }))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') search()
  }

  const pagination: TablePaginationConfig = {
    ...paginationProps(ui),
    pageSizeOptions: [10, 20, 50, 100, 150],
    ...page,
    total: query.data?.total ?? 0,
  }

  const toolbar = (
    <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--v2b-text-muted, #666)' }}>{description}</div>
      </div>
      <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
        <Input
          style={{ width: 220 }}
          placeholder="按用户邮箱搜索"
          allowClear
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          onKeyDown={onKeyDown}
        />
        {withTradeNo && (
          <Input
            style={{ width: 200 }}
            placeholder="按订单号搜索"
            allowClear
            value={draft.trade_no}
            onChange={(e) => setDraft({ ...draft, trade_no: e.target.value })}
            onKeyDown={onKeyDown}
          />
        )}
        <Button type="primary" icon={<SearchOutlined />} onClick={search}>
          搜索
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void query.refetch()}>
          刷新
        </Button>
      </div>
    </div>
  )

  return (
    <TableBlock loading={query.isFetching} bordered toolbar={toolbar}>
      <V2Table<NewPeriodLog>
        dataSource={query.data?.rows ?? []}
        columns={columns}
        pagination={pagination}
        scroll={{ x: minWidth }}
        onChange={(next) => setPage({ current: next.current ?? 1, pageSize: next.pageSize ?? page.pageSize })}
      />
    </TableBlock>
  )
}
