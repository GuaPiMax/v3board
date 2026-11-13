import {
  CaretDownOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { arrayMove } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Dropdown, Switch, Tag, Tooltip, type TableColumnsType } from 'antd'
import { useMemo, useState, type AnchorHTMLAttributes } from 'react'
import { queryKeys, usePlans, useRefetch, useServerGroups } from '@/api/queries'
import { dropPlan, sortPlans, updatePlan } from '@/api/services/plan'
import type { Plan } from '@/api/types'
import { confirmDelete } from '@/components/confirmDelete'
import { JsLink } from '@/components/JsLink'
import { TableBlock } from '@/components/TableBlock'
import { DragHandle } from '@/components/table/DragHandle'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { PERIOD_KEYS } from '@/utils/constants'
import { PlanDrawer } from './PlanDrawer'

/** 与原版 plan/fetch 一致：价格由分换算成元（null 保持 null） */
function toYuan(plan: Plan): Plan {
  const next = { ...plan }
  for (const key of PERIOD_KEYS) if (next[key] !== null) next[key] = (next[key] as number) / 100
  return next
}

const price = (value: number | null) => (value !== null ? value.toFixed(2) : '-')

const PRICE_COLUMNS: Array<[keyof Plan, string]> = [
  ['month_price', '月付'],
  ['quarter_price', '季付'],
  ['half_year_price', '半年付'],
  ['year_price', '年付'],
  ['two_year_price', '两年付'],
  ['three_year_price', '三年付'],
  ['onetime_price', '一次性'],
  ['reset_price', '重置包'],
]

// 原版为不带 href 的 <a>（颜色继承菜单项）；onClick 由 PlanDrawer 通过 cloneElement 传入
function EditLabel(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a {...props}>
      <EditOutlined /> 编辑
    </a>
  )
}

// 订阅管理（原版模块 ih8c + model plan）
export default function PlanPage() {
  const queryClient = useQueryClient()
  const { data: rawPlans = [], isFetching } = usePlans()
  const plans = useMemo(() => rawPlans.map(toYuan), [rawPlans])
  const { data: groups = [] } = useServerGroups()
  const refetch = useRefetch(queryKeys.plans)
  const [sorting, setSorting] = useState(false)
  // 右键菜单对应的行（原版 this.record）
  const [contextRecord, setContextRecord] = useState<Plan | undefined>()

  const update = async (id: number, key: 'show' | 'renew', value: 0 | 1) => {
    const res = await updatePlan(id, key, value)
    if (res.code === 200) void refetch()
  }

  // 有意修正：原版订阅删除没有确认，这里与优惠券、知识库等页面统一
  const drop = (id: number | undefined) =>
    confirmDelete(async () => {
      if (id === undefined) return
      const res = await dropPlan(id)
      if (res.code === 200) void refetch()
    })

  // 与原版一致：先在本地调整顺序，再提交全部 id，最后重新拉取
  const sort = async (fromIndex: number, toIndex: number) => {
    const next = arrayMove(rawPlans, fromIndex, toIndex)
    queryClient.setQueryData(queryKeys.plans, next)
    setSorting(true)
    const res = await sortPlans(next.map((plan) => plan.id))
    setSorting(false)
    if (res.code === 200) void refetch()
  }

  const columns: TableColumnsType<Plan> = [
    { title: '排序', dataIndex: 'sort', key: 'sort', render: () => <DragHandle /> },
    {
      title: '销售状态',
      dataIndex: 'show',
      key: 'show',
      render: (show: number, record) => (
        <Switch size="small" checked={Boolean(show)} onClick={() => void update(record.id, 'show', show ? 0 : 1)} />
      ),
    },
    {
      title: (
        <span>
          续费{' '}
          <Tooltip placement="top" title="在订阅停止销售时，已购用户是否可以续费">
            <QuestionCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: 'renew',
      key: 'renew',
      render: (renew: number, record) => (
        <Switch size="small" checked={Boolean(renew)} onClick={() => void update(record.id, 'renew', renew ? 0 : 1)} />
      ),
    },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '统计',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => (
        <>
          <UserOutlined style={{ cursor: 'move' }} /> {count}
        </>
      ),
    },
    { title: '流量', dataIndex: 'transfer_enable', key: 'transfer_enable', render: (value: number) => <>{value} GB</> },
    {
      title: '设备数限制',
      dataIndex: 'device_limit',
      key: 'device_limit',
      render: (value: number | null) => (value !== null ? value : '-'),
    },
    ...PRICE_COLUMNS.map(([key, title]) => ({ title, dataIndex: key, key, render: price })),
    {
      title: '权限组',
      dataIndex: 'group_id',
      key: 'group_id',
      render: (groupId: number | null) =>
        groups
          .filter((group) => group.id === Number.parseInt(String(groupId), 10))
          .map((group) => <Tag key={group.id}>{group.name}</Tag>),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      fixed: 'right',
      align: 'right',
      render: (_: unknown, record) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'edit',
                label: (
                  <PlanDrawer record={record} key={record.id}>
                    <EditLabel />
                  </PlanDrawer>
                ),
              },
              {
                key: 'drop',
                // 删除的红色：皮肤里取 --v2b-danger-text（见 styles/skins），legacy 下没有定义，取原值
                style: { color: 'var(--v2b-danger-text, #ff4d4f)' },
                onClick: () => drop(record.id),
                label: (
                  <>
                    <DeleteOutlined /> 删除
                  </>
                ),
              },
            ],
          }}
        >
          <JsLink>
            操作 <CaretDownOutlined />
          </JsLink>
        </Dropdown>
      ),
    },
  ]

  return (
    <AdminLayout title="订阅管理">
      <TableBlock
        loading={isFetching || sorting}
        toolbar={
          <PlanDrawer>
            <Button icon={<PlusOutlined />}>添加订阅</Button>
          </PlanDrawer>
        }
      >
        <V2Table<Plan>
          dataSource={plans}
          columns={columns}
          pagination={false}
          scroll={{ x: 1300 }}
          onDragSort={(from, to) => void sort(from, to)}
          onRowContextMenu={setContextRecord}
          contextMenu={
            <ul className="ant-dropdown-menu ant-dropdown-menu-light ant-dropdown-menu-root ant-dropdown-menu-vertical">
              <li className="ant-dropdown-menu-item">
                <PlanDrawer record={contextRecord} key={contextRecord?.id}>
                  <EditLabel />
                </PlanDrawer>
              </li>
              <li className="ant-dropdown-menu-item" onClick={() => drop(contextRecord?.id)}>
                <a style={{ color: 'var(--v2b-danger-text, #ff4d4f)' }}>
                  <DeleteOutlined /> 删除
                </a>
              </li>
            </ul>
          }
        />
      </TableBlock>
    </AdminLayout>
  )
}
