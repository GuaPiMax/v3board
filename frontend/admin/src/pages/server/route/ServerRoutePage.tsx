import { PlusOutlined } from '@ant-design/icons'
import { Button, Divider, type TableColumnsType } from 'antd'
import { queryKeys, useRefetch, useServerRoutes } from '@/api/queries'
import { dropServerRoute } from '@/api/services/serverRoute'
import type { ServerRoute } from '@/api/types'
import { confirmDelete } from '@/components/confirmDelete'
import { JsLink } from '@/components/JsLink'
import { TableBlock } from '@/components/TableBlock'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ROUTE_ACTION_TEXT } from '@/utils/constants'
import { RouteModal } from './RouteModal'

function matchCount(match: ServerRoute['match']) {
  if (match.length === 0) return '无规则时默认'
  const count = typeof match === 'string' ? match.split(',').filter(Boolean).length : match.length
  return `匹配 ${count} 条规则`
}

// 路由管理（原版模块 wtkT + model serverRoute）
export default function ServerRoutePage() {
  const { data: routes = [], isFetching } = useServerRoutes()
  const refetch = useRefetch(queryKeys.serverRoutes)

  const drop = async (id: number) => {
    const res = await dropServerRoute(id)
    if (res.code === 200) void refetch()
  }

  const columns: TableColumnsType<ServerRoute> = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '备注', dataIndex: 'remarks', key: 'remarks' },
    { title: '匹配数量', dataIndex: 'match', key: 'match', render: matchCount },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      render: (action: ServerRoute['action']) => ROUTE_ACTION_TEXT[action],
    },
    {
      title: '操作',
      dataIndex: 'action2',
      key: 'action2',
      align: 'right',
      render: (_: unknown, record) => (
        <div>
          <RouteModal route={record} key={record.id}>
            <JsLink>编辑</JsLink>
          </RouteModal>
          <Divider orientation="vertical" />
          {/* 有意修正：原版路由删除没有确认，这里与优惠券、知识库等页面统一 */}
          <JsLink onClick={() => confirmDelete(() => drop(record.id))}>删除</JsLink>
        </div>
      ),
    },
  ]

  return (
    <AdminLayout title="路由管理">
      <TableBlock
        loading={isFetching}
        toolbar={
          <RouteModal>
            <Button icon={<PlusOutlined />}>添加路由</Button>
          </RouteModal>
        }
      >
        <V2Table<ServerRoute> dataSource={routes} pagination={false} columns={columns} />
      </TableBlock>
    </AdminLayout>
  )
}
