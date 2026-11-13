// 订单详情弹窗（原版订单页模块 pi3A 里的组件）：点击订单号打开，并依次读取订单详情、下单用户、邀请人。
// 与原版一致：关闭后保留上次的内容（再打开时先显示旧内容，同时重新读取）；
// 点邮箱 / 邀请人会在用户管理里追加过滤条件后跳过去。
// 有意修正：原版点开后先显示加载图标，三个请求依次返回后内容才出现，内容多的订单会在
// 打开动画里突然从加载图标撑高到完整内容，看起来在抖。新版第一次打开时先读取，读完再打开，弹窗带着完整内容展开；
// 超过 OPEN_DELAY 还没读完时仍按原版先打开、显示加载图标
import { LoadingOutlined } from '@ant-design/icons'
import { Col, Divider, Modal, Row, Tag, Tooltip } from 'antd'
import { useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { CACHED_ONLY, usePlans } from '@/api/queries'
import { getOrderDetail } from '@/api/services/order'
import { getUserInfoById } from '@/api/services/user'
import type { AdminUser, Order } from '@/api/types'
import { JsLink } from '@/components/JsLink'
import { remainBytes } from '@/pages/newPeriodLog/planChange'
import { useUserManageStore } from '@/stores/userManage'
import { COMMISSION_STATUS_TEXT, ORDER_STATUS_TEXT, PERIOD_TEXT, type PeriodKey } from '@/utils/constants'
import { formatBytes, formatTime } from '@/utils/format'

// antd 3 的 gutter={[16, 16]}：列上下各 8px 内边距、行上移 8px（原版行的 marginBottom 设为 0）。
// antd 3 的行是浮动布局，后一行的列被上一行的浮动列挡住，实际不上移，只有每组（开头或分隔线后）的第一行上移；
// antd 6 的纵向间距改用 row-gap（对单行的 Row 不起作用），这里按 antd 3 的实际效果写出来
const COL_STYLE = { paddingTop: 8, paddingBottom: 8 }

function Line({ label, first = false, children }: { label: string; first?: boolean; children?: ReactNode }) {
  return (
    <Row gutter={16} style={{ marginTop: first ? -8 : 0, marginBottom: 0 }}>
      <Col span={6} style={COL_STYLE}>
        {label}
      </Col>
      <Col span={18} style={COL_STYLE}>
        {children}
      </Col>
    </Row>
  )
}

const yuan = (cents: number | null | undefined) => (Number(cents) / 100).toFixed(2)

/** 第一次打开时最多等待读取的时间（毫秒） */
const OPEN_DELAY = 400

export function OrderDetailModal({ orderId, children }: { orderId: number; children: ReactNode }) {
  const navigate = useNavigate()
  const { data: plans = [] } = usePlans(CACHED_ONLY)
  const [visible, setVisible] = useState(false)
  const [order, setOrder] = useState<Partial<Order>>({})
  const [user, setUser] = useState<Partial<AdminUser>>({})
  const [inviteUser, setInviteUser] = useState<Partial<AdminUser>>({})
  // 第一次打开时在等读取完成（读完或到时间才打开）
  const waiting = useRef(false)
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const openNow = () => {
    waiting.current = false
    clearTimeout(openTimer.current)
    setVisible(true)
  }

  const load = async () => {
    // 已经有上次的内容时立即打开；否则读完再打开（读取失败或较慢时到时间也打开，显示加载图标）
    if (user.email) setVisible(true)
    else if (!waiting.current) {
      waiting.current = true
      openTimer.current = setTimeout(openNow, OPEN_DELAY)
    }
    const detail = await getOrderDetail(orderId)
    if (detail.code !== 200 || !detail.data) return
    const owner = await getUserInfoById(detail.data.user_id)
    if (owner.code !== 200) return
    if (detail.data.invite_user_id) {
      const invite = await getUserInfoById(detail.data.invite_user_id)
      if (invite.code !== 200) return
      setInviteUser(invite.data ?? {})
    }
    setOrder(detail.data)
    setUser(owner.data ?? {})
    // 只在等待中打开：已经打开（再次打开、或等待超时）后读完不再改变显示，用户中途关掉的不会被重新打开
    if (waiting.current) openNow()
  }

  /** 跳到用户管理并按邮箱 / 邀请人筛选（用户页挂载时拉取） */
  const jumpUserFilter = (key: string, condition: string, value: unknown) => {
    useUserManageStore.getState().presetFilter([{ key, condition, value }])
    navigate('/user')
  }

  return (
    <div>
      <div onClick={() => void load()}>{children}</div>
      <Modal open={visible} title="订单信息" onCancel={() => setVisible(false)} footer={null}>
        {user.email ? (
          <div>
            <Line label="邮箱" first>
              <JsLink onClick={() => jumpUserFilter('email', '模糊', user.email)}>{user.email}</JsLink>
            </Line>
            <Line label="订单号">{order.trade_no}</Line>
            <Line label="订单周期">{PERIOD_TEXT[order.period as PeriodKey]}</Line>
            <Line label="订单状态">{ORDER_STATUS_TEXT[order.status as number]}</Line>
            <Line label="订阅计划">{plans.find((plan) => plan.id === order.plan_id)?.name}</Line>
            <Line label="回调单号">{order.callback_no ? order.callback_no : '-'}</Line>
            {/* v3board：已取消订单补单时的管理员备注 */}
            {order.remark ? (
              <Line label="管理员备注">
                <Tag color="orange">补单</Tag> {order.remark}
              </Line>
            ) : (
              ''
            )}
            <Divider />
            <Line label="支付金额" first>{yuan(order.total_amount)}</Line>
            <Line label="余额支付">{yuan(order.balance_amount)}</Line>
            <Line label="优惠金额">{yuan(order.discount_amount)}</Line>
            <Line label="退回金额">{yuan(order.refund_amount)}</Line>
            <Line label="折抵金额">{yuan(order.surplus_amount)}</Line>
            {/* v3board：变更订单覆盖前的订阅快照 */}
            {order.plan_change_log ? (
              <div>
                <Divider />
                <Line label="覆盖前订阅" first>
                  {order.plan_change_log.plan_name || '-'}
                </Line>
                <Line label="覆盖前到期">
                  {order.plan_change_log.old_expired_at
                    ? formatTime(Number(order.plan_change_log.old_expired_at), 'YYYY-MM-DD HH:mm:ss')
                    : '一次性'}
                </Line>
                {/* 与订阅覆盖记录页同一种格式 */}
                <Line label="覆盖前剩余流量">
                  {formatBytes(remainBytes(order.plan_change_log))} /{' '}
                  {formatBytes(order.plan_change_log.transfer_enable)}
                </Line>
                <Line label="覆盖后到期">
                  {order.plan_change_log.new_expired_at
                    ? formatTime(Number(order.plan_change_log.new_expired_at), 'YYYY-MM-DD HH:mm:ss')
                    : '一次性'}
                </Line>
              </div>
            ) : (
              ''
            )}
            <Divider />
            <Line label="创建时间" first>{formatTime(Number(order.created_at), 'YYYY-MM-DD HH:mm:ss')}</Line>
            <Line label="更新时间">{formatTime(Number(order.updated_at), 'YYYY-MM-DD HH:mm:ss')}</Line>
            {order.invite_user_id && order.status === 3 ? (
              <div>
                <Divider />
                <Line label="邀请人" first>
                  <Tooltip title="查看TA邀请的人">
                    <JsLink onClick={() => jumpUserFilter('invite_by_email', '模糊', inviteUser.email)}>
                      {inviteUser.email}
                    </JsLink>
                  </Tooltip>
                </Line>
                <Line label="佣金金额">{yuan(order.commission_balance)}</Line>
                {/* 与原版一致：实际发放为 0 时显示一个「0」 */}
                {order.actual_commission_balance && (
                  <Line label="实际发放">{yuan(order.actual_commission_balance)}</Line>
                )}
                <Line label="佣金状态">{COMMISSION_STATUS_TEXT[order.commission_status as number]}</Line>
              </div>
            ) : (
              ''
            )}
          </div>
        ) : (
          <LoadingOutlined style={{ fontSize: 24, color: 'var(--v2b-loading, #415A94)' }} />
        )}
      </Modal>
    </div>
  )
}
