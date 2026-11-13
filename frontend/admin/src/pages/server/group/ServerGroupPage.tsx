import { DatabaseOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Divider, type TableColumnsType } from 'antd'
import { queryKeys, useRefetch, useServerGroups } from '@/api/queries'
import { dropServerGroup } from '@/api/services/serverGroup'
import type { ServerGroup } from '@/api/types'
import { confirmDelete } from '@/components/confirmDelete'
import { JsLink } from '@/components/JsLink'
import { TableBlock } from '@/components/TableBlock'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { GroupModal } from './GroupModal'

// 权限组管理（原版模块 11+Y + model serverGroup）
export default function ServerGroupPage() {
  const { data: groups = [], isFetching } = useServerGroups()
  const refetch = useRefetch(queryKeys.serverGroups)

  const drop = async (id: number) => {
    const res = await dropServerGroup(id)
    if (res.code === 200) void refetch()
  }

  const columns: TableColumnsType<ServerGroup> = [
    { title: '组ID', dataIndex: 'id', key: 'id' },
    { title: '组名称', dataIndex: 'name', key: 'name' },
    {
      title: '用户数量',
      dataIndex: 'user_count',
      key: 'user_count',
      render: (value: number) => (
        <>
          <UserOutlined style={{ cursor: 'move' }} /> {value}
        </>
      ),
    },
    {
      title: '节点数量',
      dataIndex: 'server_count',
      key: 'server_count',
      render: (value: number) => (
        <>
          <DatabaseOutlined style={{ cursor: 'move' }} /> {value}
        </>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      align: 'right',
      render: (_: unknown, record) => (
        <div>
          <GroupModal record={record} key={record.id}>
            <JsLink>编辑</JsLink>
          </GroupModal>
          <Divider orientation="vertical" />
          {/* 有意修正：原版权限组删除没有确认，这里与优惠券、知识库等页面统一 */}
          <JsLink onClick={() => confirmDelete(() => drop(record.id))}>删除</JsLink>
        </div>
      ),
    },
  ]

  return (
    <AdminLayout title="权限组管理">
      <TableBlock
        loading={isFetching}
        toolbar={
          <GroupModal>
            <Button icon={<PlusOutlined />}>添加权限组</Button>
          </GroupModal>
        }
      >
        <V2Table<ServerGroup> dataSource={groups} pagination={false} columns={columns} />
      </TableBlock>
    </AdminLayout>
  )
}
