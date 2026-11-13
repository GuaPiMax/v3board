import {
  AccountBookOutlined,
  CaretDownOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  FilterOutlined,
  MailOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SelectOutlined,
  SolutionOutlined,
  StopOutlined,
  SwapOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { Badge, Button, Dropdown, Tag, Tooltip, type TableColumnsType, type TableProps } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePlans, useServerGroups } from '@/api/queries'
import type { AdminUser } from '@/api/types'
import { modal } from '@/app/staticApi'
import { FilterDrawer, type FilterKey } from '@/components/FilterDrawer'
import { JsLink } from '@/components/JsLink'
import { Loading } from '@/components/Loading'
import { V2Table } from '@/components/table/V2Table'
import { useHoverMenuClose } from '@/hooks/useHoverMenuClose'
import { useLegacyHover } from '@/hooks/useLegacyHover'
import { paginationProps } from '@/hooks/usePagedList'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useUi } from '@/stores/appearance'
import { useOrderManageStore } from '@/stores/orderManage'
import { useUserManageStore } from '@/stores/userManage'
import { copyText } from '@/utils/clipboard'
import { formatTime } from '@/utils/format'
import { setHabit } from '@/utils/storage'
import { AssignOrderModal } from '../order/AssignOrderModal'
import { CreateUserModal } from './CreateUserModal'
import { SendMailModal } from './SendMailModal'
import { TrafficLogModal } from './TrafficLogModal'
import { UserDrawer } from './UserDrawer'

/** 「设备数」列（只在前端排序） */
const DEVICE_COLUMN_KEY = 'alive_ip'

// 确认框的按钮文字与 antd 默认的「确定 / 取消」相同（原版部分确认框显式写了 okText / cancelText）
const confirm = (title: string, content: string, onOk: () => void) => modal.confirm({ title, content, onOk })

// 用户管理（原版模块 d1ca + model user）
export default function UserPage() {
  const navigate = useNavigate()
  // 与原版一样随 userManage 的任何变化重新渲染（过滤器、批量操作的按钮状态都在渲染时读取条件数组）
  const model = useUserManageStore()
  const ui = useUi()
  const { users, pagination, fetchLoading, filter } = model
  const { data: plans = [] } = usePlans()
  const { data: groups = [] } = useServerGroups()
  // 右键菜单对应的行（原版 this.record）
  const [record, setRecord] = useState<AdminUser | undefined>()
  const operations = useHoverMenuClose()
  const tips = useLegacyHover()

  useEffect(() => {
    void useUserManageStore.getState().fetch()
    return () => {
      const store = useUserManageStore.getState()
      store.empty()
      store.setState({ filter: [] })
    }
  }, [])

  const onTableChange: NonNullable<TableProps<AdminUser>['onChange']> = (next, _filters, sorter, extra) => {
    const single = Array.isArray(sorter) ? sorter[0] : sorter
    // antd 3 点击排序列取消排序时，排序参数里仍带着这一列（没有顺序），原版因此请求 sort_type=DESC&sort=<这一列>；
    // antd 6 取消时不带列。单列排序时取消的就是之前正在排序的那一列
    const columnKey = single?.columnKey ?? (extra.action === 'sort' ? model.sort.sort : undefined)
    setHabit('user_manage_page_size', next.pageSize)
    // 「设备数」只在前端排序当前页（在线设备数来自后端缓存，接口不能按它排序），请求与不排序时相同
    const serverSort = columnKey !== undefined && columnKey !== DEVICE_COLUMN_KEY
    model.changeTable(
      { current: next.current, pageSize: next.pageSize },
      {
        sort_type: serverSort && single?.order === 'ascend' ? 'ASC' : 'DESC',
        sort: serverSort ? String(columnKey) : undefined,
      },
    )
  }

  const ban = () => confirm('提醒', '确定要进行封禁吗？', () => void model.ban())
  const allDel = () => confirm('提醒', '确定要进行删除吗？', () => void model.allDel())
  const resetSecret = (user?: AdminUser) =>
    user && confirm('重置安全信息', `确定要重置${user.email}的安全信息吗？`, () => void model.resetSecret(user.id))
  const delUser = (user?: AdminUser) =>
    user && confirm('删除用户', `确定要删除${user.email}的用户信息吗？`, () => void model.delUser(user.id))
  /** 「TA的订单」：在订单管理里设置过滤条件后跳过去（订单页挂载时拉取） */
  const orderFilter = (key: string, condition: string, value: unknown) => {
    useOrderManageStore.getState().presetFilter([{ key, condition, value }])
    navigate('/order')
  }

  // 与原版一致：在线状态按渲染时的当前时间判断（最近 10 分钟内在线）
  // oxlint-disable-next-line react/purity
  const now = Date.now() / 1000

  const columns: TableColumnsType<AdminUser> = [
    { title: 'ID', dataIndex: 'id', key: 'id', sorter: true },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email: string, user) => (
        <Tooltip placement="top" title={user.t ? `最后在线${formatTime(user.t, 'YYYY-MM-DD HH:mm:ss')}` : '从未在线'}>
          <Badge status={now - 600 > user.t ? 'default' : 'success'} />
          {email}
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'banned',
      key: 'banned',
      sorter: true,
      render: (banned: number) => <Tag color={banned ? 'red' : 'green'}>{banned ? '封禁' : '正常'}</Tag>,
    },
    { title: '订阅', dataIndex: 'plan_name', key: 'plan_id', sorter: true, render: (name?: string) => name || '-' },
    {
      title: '权限组',
      dataIndex: 'group_id',
      key: 'group_id',
      sorter: true,
      render: (id: number | null) => groups.find((group) => group.id === id)?.name ?? '-',
    },
    {
      title: '已用(G)',
      dataIndex: 'total_used',
      key: 'total_used',
      sorter: true,
      render: (used: string, user) => (
        <Tag color={Number.parseFloat(used) > Number.parseFloat(user.transfer_enable) ? 'red' : 'green'}>{used}</Tag>
      ),
    },
    { title: '流量(G)', dataIndex: 'transfer_enable', key: 'transfer_enable', sorter: true },
    {
      title: '设备数',
      dataIndex: 'device_limit',
      // 原版这一列的 key 是 updated_at：排序时后端按 updated_at 排序、前端再按在线设备数排序当前页，有意修正
      key: DEVICE_COLUMN_KEY,
      sorter: (a, b) => Number(a.alive_ip) - Number(b.alive_ip),
      render: (_: unknown, user) => {
        const text = `${user.alive_ip !== null ? user.alive_ip : 0} / ${user.device_limit !== null ? user.device_limit : '∞'}`
        return user.ips ? (
          <Tooltip placement="top" title={user.ips}>
            {text}
          </Tooltip>
        ) : (
          text
        )
      },
    },
    {
      title: '到期时间',
      dataIndex: 'expired_at',
      key: 'expired_at',
      sorter: true,
      render: (expiredAt: number | null) => (
        <Tag color={expiredAt !== null && expiredAt < now ? 'red' : 'green'}>
          {expiredAt ? formatTime(expiredAt) : expiredAt === null ? '长期有效' : '-'}
        </Tag>
      ),
    },
    {
      // v3board：距下次流量重置天数
      title: (
        <span>
          <Tooltip
            placement="top"
            title="距下次流量重置的天数，按套餐/站点设置的流量重置方式计算；不重置或订阅无效时显示 -"
          >
            流量重置 <QuestionCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: 'reset_day',
      key: 'reset_day',
      render: (day: number | null | undefined) =>
        day === null || day === undefined ? (
          '-'
        ) : (
          <Tag color={day <= 3 ? 'orange' : 'blue'}>{day === 0 ? '不足 1 天' : `${day} 天后`}</Tag>
        ),
    },
    { title: '余额', dataIndex: 'balance', key: 'balance', sorter: true },
    { title: '佣金', dataIndex: 'commission_balance', key: 'commission_balance', sorter: true },
    {
      title: '加入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      render: (createdAt: number) => formatTime(createdAt),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      align: 'right',
      fixed: 'right',
      render: (_: unknown, user) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'edit',
                label: (
                  <UserDrawer userId={user.id} key={user.id}>
                    <a>
                      <EditOutlined /> 编辑
                    </a>
                  </UserDrawer>
                ),
              },
              {
                key: 'assign',
                label: (
                  <AssignOrderModal email={user.email} key={user.email}>
                    <a>
                      <PlusOutlined /> 分配订单
                    </a>
                  </AssignOrderModal>
                ),
              },
              {
                key: 'copy',
                label: (
                  <a onClick={() => copyText(user.subscribe_url ?? '')}>
                    <CopyOutlined /> 复制订阅URL
                  </a>
                ),
              },
              {
                key: 'reset',
                label: (
                  <a onClick={() => resetSecret(user)}>
                    <ReloadOutlined /> 重置UUID及订阅URL
                  </a>
                ),
              },
              {
                key: 'orders',
                onClick: () => orderFilter('user_id', '=', user.id),
                label: (
                  <a>
                    <AccountBookOutlined /> TA的订单
                  </a>
                ),
              },
              {
                key: 'invites',
                onClick: () => model.addFilter('invite_user_id', '=', user.id, true),
                label: (
                  <a>
                    <UsergroupAddOutlined /> TA的邀请
                  </a>
                ),
              },
              // v3board：提前续期记录、订阅覆盖记录
              {
                key: 'newPeriodLog',
                onClick: () => navigate(`/newPeriodLog?email=${encodeURIComponent(user.email)}`),
                label: (
                  <a>
                    <ReloadOutlined /> TA的提前续期记录
                  </a>
                ),
              },
              {
                key: 'planChangeLog',
                onClick: () => navigate(`/planChangeLog?email=${encodeURIComponent(user.email)}`),
                label: (
                  <a>
                    <SwapOutlined /> TA的订阅覆盖记录
                  </a>
                ),
              },
              {
                key: 'traffic',
                label: (
                  <TrafficLogModal userId={user.id} key={user.email}>
                    <a>
                      <SolutionOutlined /> TA的流量记录
                    </a>
                  </TrafficLogModal>
                ),
              },
              {
                key: 'delete',
                label: (
                  <a onClick={() => delUser(user)}>
                    <DeleteOutlined /> 删除用户
                  </a>
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

  const filterKeys: FilterKey[] = [
    { key: 'email', title: '邮箱', condition: ['模糊'] },
    { key: 'id', title: '用户ID', condition: ['=', '>=', '>', '<', '<='] },
    {
      key: 'plan_id',
      title: '订阅',
      condition: ['='],
      type: 'select',
      options: [{ key: '无订阅', value: 'null' }, ...plans.map((plan) => ({ key: plan.name, value: plan.id }))],
    },
    { key: 'transfer_enable', title: '流量', condition: ['>=', '>', '<', '<='] },
    { key: 'd', title: '下行', condition: ['>=', '>', '<', '<='] },
    { key: 'expired_at', title: '到期时间', condition: ['>=', '>', '<', '<='], type: 'date' },
    { key: 'uuid', title: 'UUID', condition: ['='] },
    { key: 'token', title: 'TOKEN', condition: ['='] },
    {
      key: 'banned',
      title: '账号状态',
      condition: ['='],
      type: 'select',
      options: [
        { key: '正常', value: 0 },
        { key: '封禁', value: 1 },
      ],
    },
    { key: 'invite_by_email', title: '邀请人邮箱', condition: ['模糊'] },
    { key: 'invite_user_id', title: '邀请人ID', condition: ['='] },
    { key: 'remarks', title: '备注', condition: ['模糊'] },
    {
      key: 'is_admin',
      title: '管理员',
      condition: ['='],
      type: 'select',
      options: [
        { key: '是', value: 1 },
        { key: '否', value: 0 },
      ],
    },
  ]

  return (
    <AdminLayout title="用户管理">
      <Loading loading={fetchLoading}>
        <div className="block border-bottom">
          <div className="bg-white">
            <div className="v2board-table-action" style={{ padding: 15 }}>
              <Tooltip
                title="Tips：可以使用过滤器过滤后再使用操作对过滤的用户进行操作。"
                placement="right"
                open={tips.open}
              >
                <Button.Group {...tips.handlers}>
                  <FilterDrawer value={filter} onOk={model.filterBy} keys={filterKeys}>
                    <Button type={filter.length > 0 ? 'primary' : 'default'} icon={<FilterOutlined />}>
                      过滤器
                    </Button>
                  </FilterDrawer>
                  {/* 层级固定为 antd 3 的 1050（在 Tips 提示里，见 FilterDrawer） */}
                  <Dropdown
                    {...operations}
                    styles={{ root: { zIndex: 1050 } }}
                    menu={{
                      items: [
                        {
                          key: 'csv',
                          label: (
                            <a onClick={() => void model.dumpCSV()}>
                              <FileExcelOutlined /> 导出CSV
                            </a>
                          ),
                        },
                        {
                          key: 'mail',
                          label: (
                            <SendMailModal>
                              <a>
                                <MailOutlined /> 发送邮件
                              </a>
                            </SendMailModal>
                          ),
                        },
                        {
                          key: 'ban',
                          disabled: !filter.length,
                          label: (
                            // @ts-expect-error 与原版一致：链接上的 disabled 属性（配合 a[disabled] 样式不可点击）
                            <a disabled={!filter.length} onClick={ban}>
                              <StopOutlined /> 批量封禁
                            </a>
                          ),
                        },
                        {
                          key: 'delete',
                          disabled: !filter.length,
                          label: (
                            // @ts-expect-error 同上
                            <a disabled={!filter.length} onClick={allDel}>
                              <DeleteOutlined /> 批量删除
                            </a>
                          ),
                        },
                      ],
                    }}
                  >
                    <Button icon={<SelectOutlined />}>操作</Button>
                  </Dropdown>
                </Button.Group>
              </Tooltip>
              <CreateUserModal>
                <Button className="ml-2">
                  <UserAddOutlined />
                </Button>
              </CreateUserModal>
            </div>
            <V2Table<AdminUser>
              className="v2board-table"
              dataSource={users}
              pagination={{ ...pagination, ...paginationProps(ui) }}
              columns={columns}
              scroll={{ x: 1600 }} // v3board：多了「流量重置」列，原为 1500
              onChange={onTableChange}
              onRowContextMenu={setRecord}
              contextMenu={
                <ul className="ant-dropdown-menu ant-dropdown-menu-light ant-dropdown-menu-root ant-dropdown-menu-vertical">
                  <li className="ant-dropdown-menu-item">
                    <UserDrawer userId={record?.id} key={record?.id}>
                      <a>
                        <EditOutlined /> 编辑
                      </a>
                    </UserDrawer>
                  </li>
                  <li className="ant-dropdown-menu-item">
                    <AssignOrderModal email={record?.email} key={record?.email}>
                      <a>
                        <PlusOutlined /> 分配订单
                      </a>
                    </AssignOrderModal>
                  </li>
                  <li className="ant-dropdown-menu-item">
                    <a onClick={() => copyText(record?.subscribe_url ?? '')}>
                      <CopyOutlined /> 复制订阅URL
                    </a>
                  </li>
                  <li className="ant-dropdown-menu-item">
                    {/* 红色：皮肤里取 --v2b-danger-text（见 styles/skins），legacy 下没有定义，取原值 */}
                    <a style={{ color: 'var(--v2b-danger-text, #ff4d4f)' }} onClick={() => resetSecret(record)}>
                      <ReloadOutlined /> 重置UUID及订阅URL
                    </a>
                  </li>
                  <li className="ant-dropdown-menu-item" onClick={() => orderFilter('user_id', '=', record?.id)}>
                    <a>
                      <AccountBookOutlined /> TA的订单
                    </a>
                  </li>
                  <li
                    className="ant-dropdown-menu-item"
                    onClick={() => model.addFilter('invite_user_id', '=', record?.id, true)}
                  >
                    <a>
                      <UsergroupAddOutlined /> TA的邀请
                    </a>
                  </li>
                  <li
                    className="ant-dropdown-menu-item"
                    onClick={() => navigate(`/newPeriodLog?email=${encodeURIComponent(record?.email ?? '')}`)}
                  >
                    <a>
                      <ReloadOutlined /> TA的提前续期记录
                    </a>
                  </li>
                  <li
                    className="ant-dropdown-menu-item"
                    onClick={() => navigate(`/planChangeLog?email=${encodeURIComponent(record?.email ?? '')}`)}
                  >
                    <a>
                      <SwapOutlined /> TA的订阅覆盖记录
                    </a>
                  </li>
                  <li className="ant-dropdown-menu-item">
                    <TrafficLogModal userId={record?.id} key={record?.email}>
                      <a>
                        <SolutionOutlined /> TA的流量记录
                      </a>
                    </TrafficLogModal>
                  </li>
                  <li className="ant-dropdown-menu-item">
                    <a onClick={() => delUser(record)}>
                      <DeleteOutlined /> 删除用户
                    </a>
                  </li>
                </ul>
              }
            />
          </div>
        </div>
      </Loading>
    </AdminLayout>
  )
}
