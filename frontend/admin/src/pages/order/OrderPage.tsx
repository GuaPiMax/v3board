import { CaretDownOutlined, FilterOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { Badge, Button, Dropdown, Input, Tag, Tooltip, type TableColumnsType } from 'antd'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { usePlans } from '@/api/queries'
import type { Order } from '@/api/types'
import { modal } from '@/app/staticApi'
import { FilterDrawer, type FilterKey } from '@/components/FilterDrawer'
import { JsLink } from '@/components/JsLink'
import { Loading } from '@/components/Loading'
import { V2Table } from '@/components/table/V2Table'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useOrderManageStore } from '@/stores/orderManage'
import { useUserManageStore } from '@/stores/userManage'
import { COMMISSION_STATUS_TEXT, ORDER_STATUS_TEXT, PERIOD_TEXT, type PeriodKey } from '@/utils/constants'
import { formatTime } from '@/utils/format'
import { AssignOrderModal } from './AssignOrderModal'
import { OrderDetailModal } from './OrderDetailModal'

const TYPE_TEXT: Record<number, string> = { 1: '新购', 2: '续费', 3: '变更', 4: '流量包', 9: '充值' }
const ORDER_BADGE = ['error', 'processing', 'default', 'success', 'default'] as const
const COMMISSION_BADGE = ['default', 'processing', 'success', 'error'] as const

const FILTER_KEYS: FilterKey[] = [
  { key: 'trade_no', title: '订单号', condition: ['模糊', '='] },
  {
    key: 'status',
    title: '订单状态',
    type: 'select',
    condition: ['='],
    options: [
      { key: '未支付', value: 0 },
      { key: '已支付', value: 1 },
      { key: '已取消', value: 2 },
      { key: '已完成', value: 3 },
      { key: '已折抵', value: 4 },
    ],
  },
  {
    key: 'commission_status',
    title: '佣金状态',
    type: 'select',
    condition: ['='],
    options: [
      { key: '待确认', value: 0 },
      { key: '发放中', value: 1 },
      { key: '已发放', value: 2 },
      { key: '无效', value: 3 },
    ],
  },
  { key: 'user_id', title: '用户ID', condition: ['='] },
  { key: 'invite_user_id', title: '邀请人ID', condition: ['=', '!='] },
  { key: 'callback_no', title: '回调单号', condition: ['模糊'] },
  { key: 'commission_balance', title: '佣金金额', condition: ['>', '<', '=', '!=', '>=', '<='] },
]

// 订单管理（原版模块 pi3A + model order）
export default function OrderPage() {
  const navigate = useNavigate()
  // 与原版一样随 orderManage 的任何变化重新渲染
  const model = useOrderManageStore()
  const { orders, fetchLoading, pagination, filter } = model
  usePlans()

  /** v3board：点用户邮箱跳到用户管理并按邮箱筛选（用户页挂载时拉取） */
  const jumpUser = (email: string) => {
    useUserManageStore.getState().presetFilter([{ key: 'email', condition: '模糊', value: email }])
    navigate('/user')
  }

  /** v3board：已取消订单补单，备注必填，作为标注显示在订单上 */
  const confirmPaidFromCancelled = (order: Order) => {
    let remark = '已核实收款，补单'
    let submitting = false
    const instance = modal.confirm({
      title: '已取消订单补单',
      okText: '确认补单',
      cancelText: '取消',
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>该订单已取消，确认改为已支付并由系统开通？</p>
          {order.balance_amount ? (
            <p style={{ color: '#fa8c16', marginBottom: 8 }}>
              注意：该订单取消时已退还余额 {(order.balance_amount / 100).toFixed(2)}{' '}
              元，补单将从用户余额重新扣回，余额不足会失败。
            </p>
          ) : null}
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
            补单备注（必填，将作为标注显示在订单上）
          </div>
          <Input
            defaultValue={remark}
            maxLength={255}
            placeholder="请输入补单备注"
            onChange={(e) => {
              remark = e.target.value
            }}
          />
        </div>
      ),
      // 带 close 参数时 antd 不自动关闭：备注为空提示后保持打开，补单成功才关闭（失败时保留已填的备注）
      onOk: (close: () => void) => {
        const text = remark.trim()
        if (!text) {
          modal.warning({
            title: '请填写补单备注',
            content: '备注会作为标注显示在订单上，方便日后核对。',
            okText: '知道了',
          })
          return
        }
        if (submitting) return
        submitting = true
        // 提交中：确认按钮转圈、「取消」禁用、Esc 不关闭；confirm 的遮罩默认就不可点击关闭，不用再改
        instance.update({ okButtonProps: { loading: true }, cancelButtonProps: { disabled: true }, keyboard: false })
        void model.paid(order.trade_no, text).then((ok) => {
          submitting = false
          instance.update({ okButtonProps: { loading: false }, cancelButtonProps: { disabled: false }, keyboard: true })
          if (ok) close()
        })
      },
    })
  }

  useEffect(() => {
    void useOrderManageStore.getState().fetch()
    return () => {
      const store = useOrderManageStore.getState()
      store.empty()
      store.setState({ filter: [] })
    }
  }, [])

  const columns: TableColumnsType<Order> = [
    {
      title: '# 订单号',
      dataIndex: 'trade_no',
      key: 'trade_no',
      render: (tradeNo: string, order) => (
        <OrderDetailModal orderId={order.id}>
          <JsLink>
            {tradeNo.substr(0, 3)}...{tradeNo.substr(-3)}
          </JsLink>
        </OrderDetailModal>
      ),
    },
    {
      // v3board：下单用户
      title: '用户',
      dataIndex: 'user_email',
      key: 'user_email',
      render: (email: string | null | undefined) =>
        email ? (
          <Tooltip placement="top" title="在用户管理中查看该用户">
            <JsLink onClick={() => jumpUser(email)}>{email}</JsLink>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      // v3board：有订阅覆盖记录的变更订单可跳到覆盖记录
      render: (type: number, order) =>
        type === 3 && order.has_plan_change_log ? (
          <div>
            {TYPE_TEXT[type]}{' '}
            <Tooltip placement="top" title="查看该订单覆盖前的订阅信息">
              <JsLink onClick={() => navigate(`/planChangeLog?trade_no=${encodeURIComponent(order.trade_no)}`)}>
                覆盖记录
              </JsLink>
            </Tooltip>
          </div>
        ) : (
          TYPE_TEXT[type]
        ),
    },
    { title: '订阅计划', dataIndex: 'plan_name', key: 'plan_name' },
    {
      title: '周期',
      dataIndex: 'period',
      key: 'period',
      align: 'center',
      render: (_: string, order) => <Tag>{PERIOD_TEXT[order.period as PeriodKey]}</Tag>,
    },
    {
      title: '支付金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      render: (amount: number) => (amount / 100).toFixed(2),
    },
    {
      title: (
        <span>
          <Tooltip placement="top" title="标记为[已支付]后将会由系统进行开通后并完成">
            订单状态 <QuestionCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: 'status',
      key: 'status',
      // v3board：已取消订单也可以标记为已支付（补单，备注必填）；有备注的订单显示「补单」标注
      render: (status: number, order) => (
        <div>
          <Dropdown
            disabled={status !== 0 && status !== 2}
            trigger={['click']}
            menu={{
              items: [
                {
                  key: '1',
                  label: status === 2 ? '已支付（已取消订单补单）' : '已支付',
                  onClick: () => (status === 2 ? confirmPaidFromCancelled(order) : void model.paid(order.trade_no)),
                },
                ...(status === 0
                  ? [{ key: '2', label: '取消', onClick: () => void model.cancel(order.trade_no) }]
                  : []),
              ],
            }}
          >
            <div>
              <Badge status={ORDER_BADGE[status]} />
              <span>{ORDER_STATUS_TEXT[status]} </span>
              {order.remark ? (
                <Tooltip placement="top" title={`补单备注：${order.remark}`}>
                  <Tag color="orange">补单</Tag>
                </Tooltip>
              ) : null}
              {(status === 0 || status === 2) && (
                <JsLink>
                  标记为 <CaretDownOutlined />
                </JsLink>
              )}
            </div>
          </Dropdown>
        </div>
      ),
    },
    {
      title: '佣金金额',
      dataIndex: 'commission_balance',
      key: 'commission_balance',
      align: 'right',
      render: (amount: number, order) =>
        order.status === 0 || order.status === 2 ? '-' : amount ? (amount / 100).toFixed(2) : '-',
    },
    {
      title: (
        <span>
          佣金状态{' '}
          <Tooltip placement="top" title="标记为[有效]后将会由系统处理后发放到用户并完成">
            <QuestionCircleOutlined />
          </Tooltip>
        </span>
      ),
      dataIndex: 'commission_status',
      key: 'commission_status',
      render: (commissionStatus: number, order) => {
        if (order.status === 0 || order.status === 2) return '-'
        if (!order.commission_balance) return '-'
        const label = (
          <>
            <Badge status={COMMISSION_BADGE[commissionStatus]} />
            <span>{COMMISSION_STATUS_TEXT[commissionStatus]} </span>
          </>
        )
        if (commissionStatus === 2) return <div>{label}</div>
        const mark = (key: string, text: string, value: number) => ({
          key,
          label: text,
          disabled: commissionStatus === value,
          onClick: ({ key: next }: { key: string }) => void model.update(order.trade_no, 'commission_status', next),
        })
        return (
          <div>
            <Dropdown
              trigger={['click']}
              menu={{ items: [mark('0', '待确认', 0), mark('1', '有效', 1), mark('3', '无效', 3)] }}
            >
              <div>
                {label}
                <JsLink>
                  标记为 <CaretDownOutlined />
                </JsLink>
              </div>
            </Dropdown>
          </div>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      align: 'right',
      render: (createdAt: number) => formatTime(createdAt),
    },
  ]

  return (
    <AdminLayout title="订单管理">
      <div className="d-flex justify-content-between align-items-center" />
      <Loading loading={fetchLoading}>
        <div className="block block-rounded">
          <div className="bg-white">
            <div style={{ padding: 15 }}>
              <Button.Group>
                <FilterDrawer value={filter} onOk={model.filterBy} keys={FILTER_KEYS}>
                  <Button type={filter.length > 0 ? 'primary' : 'default'} icon={<FilterOutlined />}>
                    过滤器
                  </Button>
                </FilterDrawer>
              </Button.Group>
              <AssignOrderModal>
                <Button style={{ marginLeft: 10 }} icon={<PlusOutlined />}>
                  添加订单
                </Button>
              </AssignOrderModal>
            </div>
            <V2Table<Order>
              dataSource={orders}
              pagination={{ ...pagination, current: pagination.current || 1, size: 'small' }}
              columns={columns}
              // v3board：多了「用户」列，原为 1050
              scroll={{ x: 1250 }}
              onChange={(next) => model.changeTable({ current: next.current, pageSize: next.pageSize })}
            />
          </div>
        </div>
      </Loading>
    </AdminLayout>
  )
}
