// 最近事件（独占一个标签页）：登录 / 订阅拉取的审计记录（按小时汇总：同一用户、类型、IP、UA 一小时内合并为一行），服务端分页，可按用户 ID 与事件类型筛选
import { SearchOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Input, Select, type TablePaginationConfig } from 'antd'
import { useState } from 'react'
import { ApiError } from '@/api/request'
import { fetchGuardEvents } from '@/api/services/insiderGuard'
import type { GuardEvent, GuardEventType } from '@/api/types'
import { message } from '@/app/staticApi'
import { paginationProps } from '@/hooks/usePagedList'
import { useUi } from '@/stores/appearance'
import { eventColumns, Failed, guardKeys, Note, parseUserId, Section, SubTable } from './shared'

interface EventFilter {
  user_id: string
  event_type: GuardEventType | ''
}

const TYPE_OPTIONS: Array<{ value: GuardEventType | ''; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'login', label: '登录' },
  { value: 'subscription', label: '订阅' },
]

const columns = eventColumns({ withUser: true, typeTag: true })

export function RecentEvents() {
  const ui = useUi()
  const [draft, setDraft] = useState<EventFilter>({ user_id: '', event_type: '' })
  const [filter, setFilter] = useState<EventFilter>(draft)
  const [page, setPage] = useState({ current: 1, pageSize: 20 })

  const query = useQuery({
    queryKey: [...guardKeys.events, filter, page],
    queryFn: async () => {
      const userId = Number.parseInt(filter.user_id, 10)
      const res = await fetchGuardEvents({
        ...page,
        user_id: Number.isNaN(userId) ? undefined : userId,
        event_type: filter.event_type || undefined,
      })
      if (res.code !== 200) throw new ApiError(res.code, res.msg)
      return { rows: res.data ?? [], total: res.total ?? 0 }
    },
    placeholderData: keepPreviousData,
  })

  const search = () => {
    const userId = draft.user_id.trim()
    // 只接受纯数字且 ≥ 1 的用户 ID（与「用户详情」一致），否则不发请求
    if (userId && parseUserId(userId) === undefined) {
      message.error('请输入有效的用户 ID')
      return
    }
    // 条件没变（包括读取失败后再点「筛选」）：key 不变不会自动重新请求，这里直接重拉
    if (userId === filter.user_id && draft.event_type === filter.event_type && page.current === 1) {
      void query.refetch()
      return
    }
    setFilter({ user_id: userId, event_type: draft.event_type })
    setPage((p) => ({ ...p, current: 1 }))
  }

  const pagination: TablePaginationConfig = { ...paginationProps(ui), ...page, total: query.data?.total ?? 0 }

  return (
    <Section
      extra={
        <>
          <Input
            style={{ width: 160 }}
            placeholder="按用户 ID 筛选"
            allowClear
            value={draft.user_id}
            onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') search()
            }}
          />
          <Select<GuardEventType | ''>
            style={{ width: 110 }}
            value={draft.event_type}
            options={TYPE_OPTIONS}
            onChange={(type) => setDraft({ ...draft, event_type: type })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={search}>
            筛选
          </Button>
        </>
      }
    >
      <Note style={{ marginBottom: 12 }}>
        同一用户、类型、IP、UA
        在同一小时内的多次记录合并为一行，「次数」为合计；时间为该小时内最近一次，合并了多次时下方小字为首次时间。
      </Note>
      {query.isError && !query.data ? (
        <Failed>读取失败：事件列表暂时无法加载，请点「筛选」重试</Failed>
      ) : (
        <SubTable<GuardEvent>
          loading={query.isFetching}
          dataSource={query.data?.rows ?? []}
          columns={columns}
          pagination={pagination}
          scroll={{ x: 970 }}
          onChange={(next) => setPage({ current: next.current ?? 1, pageSize: next.pageSize ?? page.pageSize })}
        />
      )}
    </Section>
  )
}
