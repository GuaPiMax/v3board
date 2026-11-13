import { PlusOutlined } from '@ant-design/icons'
import { arrayMove } from '@dnd-kit/sortable'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Divider, Switch, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { unwrap } from '@/api/request'
import {
  dropKnowledge,
  fetchKnowledgeCategories,
  fetchKnowledges,
  sortKnowledges,
  toggleKnowledgeShow,
} from '@/api/services/knowledge'
import type { Knowledge } from '@/api/types'
import { confirmDelete } from '@/components/confirmDelete'
import { JsLink } from '@/components/JsLink'
import { TableBlock } from '@/components/TableBlock'
import { DragHandle } from '@/components/table/DragHandle'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { formatTime } from '@/utils/format'
import { KnowledgeDrawer } from './KnowledgeDrawer'

const LIST_KEY = ['knowledge', 'list']

// 知识库管理（原版模块 jJ5y + model knowledge）
export default function KnowledgePage() {
  const queryClient = useQueryClient()
  const { data: knowledges = [], isFetching } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => unwrap(fetchKnowledges()),
  })
  // 与原版一致：进入页面时请求分类列表（界面上没有用到）
  useQuery({ queryKey: ['knowledge', 'category'], queryFn: () => unwrap(fetchKnowledgeCategories()) })
  const [sorting, setSorting] = useState(false)

  const refetch = () => queryClient.invalidateQueries({ queryKey: LIST_KEY })

  const drop = async (record: Knowledge) => {
    const res = await dropKnowledge(record.id)
    if (res.code === 200) void refetch()
  }

  // 与原版一致：先在本地调整顺序，再提交全部 id，最后重新拉取
  const sort = async (fromIndex: number, toIndex: number) => {
    const next = arrayMove(knowledges, fromIndex, toIndex)
    queryClient.setQueryData(LIST_KEY, next)
    setSorting(true)
    const res = await sortKnowledges(next.map((k) => k.id))
    setSorting(false)
    if (res.code === 200) void refetch()
  }

  const columns: TableColumnsType<Knowledge> = [
    { title: '排序', dataIndex: 'sort', key: 'sort', render: () => <DragHandle /> },
    { title: '文章ID', dataIndex: 'id', key: 'id' },
    {
      title: '显示',
      dataIndex: 'show',
      key: 'show',
      render: (show: number, record) => (
        <Switch
          size="small"
          checked={Boolean(show)}
          onChange={async () => {
            const res = await toggleKnowledgeShow(record.id)
            if (res.code === 200) void refetch()
          }}
        />
      ),
    },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      align: 'right',
      render: (value: number) => formatTime(value),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      align: 'right',
      fixed: 'right',
      render: (_: unknown, record) => (
        <>
          <KnowledgeDrawer id={record.id} onSaved={refetch}>
            <JsLink>编辑</JsLink>
          </KnowledgeDrawer>
          <Divider orientation="vertical" />
          <JsLink onClick={() => confirmDelete(() => drop(record))}>删除</JsLink>
        </>
      ),
    },
  ]

  return (
    <AdminLayout title="知识库管理">
      <TableBlock
        bordered
        loading={isFetching || sorting}
        toolbar={
          <KnowledgeDrawer onSaved={refetch}>
            <Button icon={<PlusOutlined />}>新增</Button>
          </KnowledgeDrawer>
        }
      >
        <V2Table<Knowledge>
          dataSource={knowledges}
          pagination={false}
          columns={columns}
          scroll={{ x: 750 }}
          onDragSort={(from, to) => void sort(from, to)}
        />
      </TableBlock>
    </AdminLayout>
  )
}
