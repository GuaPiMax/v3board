import { Badge, Divider, Input, Radio, type TableColumnsType, type TableProps } from 'antd'
import { useEffect, useRef } from 'react'
import type { Ticket } from '@/api/types'
import { JsLink } from '@/components/JsLink'
import { Loading } from '@/components/Loading'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useTicketManageStore } from '@/stores/ticketManage'
import { formatTime } from '@/utils/format'

const LEVEL_TEXT = ['低', '中', '高']
const FIRST_PAGE = { pageSize: 10, current: 1 }

/**
 * 打开工单对话（原版 toChat）：桌面端在 800×600 的新窗口打开，手机 / iPad 在当前页打开
 */
function toChat(id: number) {
  const url = `${window.location.origin}${window.location.pathname}#/ticket/${id}`
  const ua = window.navigator.userAgent.toLowerCase()
  if (ua.indexOf('mobile') === -1 && ua.indexOf('ipad') === -1) {
    window.open(
      url,
      '_blank',
      'height=600,width=800,top=0,left=0,toolbar=no,menubar=no,scrollbars=no,resizable=no,location=no,status=no',
    )
  } else {
    window.location.href = url
  }
}

// 工单管理（原版模块 RJTe + model ticket）
export default function TicketPage() {
  // 与原版一样随 ticketManage 的任何变化重新渲染
  const model = useTicketManageStore()
  const { tickets, fetchLoading, pagination, filter } = model
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    void useTicketManageStore.getState().fetch()
  }, [])

  // antd 3 的 onChange 只带用过筛选的列，重置后是空数组；antd 6 对没有筛选的列传 null（会被序列化成空参数），换成 undefined
  const onTableChange: NonNullable<TableProps<Ticket>['onChange']> = (next, filters) => {
    const legacyFilters = Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value ?? undefined]))
    model.filterBy({ current: next.current, pageSize: next.pageSize }, legacyFilters)
  }

  const columns: TableColumnsType<Ticket> = [
    { title: '#', dataIndex: 'id', key: 'id' },
    { title: '主题', dataIndex: 'subject', key: 'subject' },
    { title: '工单级别', dataIndex: 'level', key: 'level', render: (level: number) => LEVEL_TEXT[level] },
    {
      title: '工单状态',
      dataIndex: 'reply_status',
      key: 'reply_status',
      // 「已关闭」标签页不显示筛选
      filters:
        filter.status !== 1
          ? [
              { text: '已回复', value: 1 },
              { text: '待回复', value: 0 },
            ]
          : undefined,
      render: (replyStatus: number, ticket) =>
        ticket.status === 1 ? (
          <span>
            <Badge status="success" />
            已关闭
          </span>
        ) : (
          <span>
            <Badge status={replyStatus ? 'processing' : 'error'} />
            {replyStatus ? '已回复' : '待回复'}
          </span>
        ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (value: number) => formatTime(value) },
    { title: '最后回复', dataIndex: 'updated_at', key: 'updated_at', render: (value: number) => formatTime(value) },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      align: 'right',
      fixed: 'right',
      render: (_: unknown, ticket) => (
        <div>
          <JsLink onClick={() => toChat(ticket.id)}>查看</JsLink>
          <Divider orientation="vertical" />
          {/* @ts-expect-error 与原版一致：已关闭的工单链接带 disabled 属性（配合 a[disabled] 样式不可点击） */}
          <JsLink disabled={Boolean(ticket.status)} onClick={() => void model.close(ticket.id)}>
            关闭
          </JsLink>
        </div>
      ),
    },
  ]

  return (
    <AdminLayout title="工单管理">
      <Loading loading={fetchLoading}>
        <div className="block border-bottom">
          <div className="bg-white">
            <div className="p-3">
              <Radio.Group
                value={filter.status}
                onChange={(e) => model.filterBy(FIRST_PAGE, { status: e.target.value })}
              >
                <Radio.Button value={0}>已开启</Radio.Button>
                <Radio.Button value={1}>已关闭</Radio.Button>
              </Radio.Group>
              <div style={{ float: 'right' }}>
                {/* 筛选条件离开页面后仍保留（与原版一致），输入框显示当前生效的邮箱
                    （原版回到页面时输入框是空的，却仍按上次的邮箱筛选，有意修正） */}
                <Input
                  placeholder="输入邮箱搜索"
                  defaultValue={typeof filter.email === 'string' ? filter.email : undefined}
                  onChange={(e) => {
                    const email = e.target.value
                    clearTimeout(searchTimer.current)
                    searchTimer.current = setTimeout(() => model.filterBy(FIRST_PAGE, { email }), 300)
                  }}
                />
              </div>
            </div>
            <V2Table<Ticket>
              dataSource={tickets}
              pagination={{ ...pagination, size: 'small' }}
              columns={columns}
              scroll={{ x: 900 }}
              onChange={onTableChange}
            />
          </div>
        </div>
      </Loading>
    </AdminLayout>
  )
}
