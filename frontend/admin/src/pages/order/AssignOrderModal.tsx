// 分配订单弹窗（原版模块 mCd/；订单管理「添加订单」、用户管理「分配订单」预填邮箱）。
// 与原版一致：点击触发元素切换显示，关闭时表单恢复为初始值（邮箱为传入的 email）
import { LoadingOutlined } from '@ant-design/icons'
import { Input, Modal, Select } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { CACHED_ONLY, usePlans } from '@/api/queries'
import { FormGroup } from '@/components/FormGroup'
import { useOrderManageStore } from '@/stores/orderManage'
import { PERIOD_KEYS, PERIOD_TEXT } from '@/utils/constants'

interface AssignForm {
  email?: string
  plan_id?: number
  period?: string
  total_amount?: string
}

interface AssignOrderModalProps {
  email?: string
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

const PERIOD_OPTIONS = PERIOD_KEYS.map((key) => ({ value: key, label: PERIOD_TEXT[key] }))

export function AssignOrderModal({ email, children }: AssignOrderModalProps) {
  const initial = (): AssignForm => ({ email: email || undefined, plan_id: undefined, period: undefined, total_amount: undefined })
  const [visible, setVisible] = useState(false)
  const [submit, setSubmit] = useState<AssignForm>(initial)
  const assignLoading = useOrderManageStore((s) => s.assignLoading)
  const { data: plans = [] } = usePlans(CACHED_ONLY)

  const toggle = () => {
    const next = !visible
    setVisible(next)
    if (!next) setSubmit(initial())
  }
  const change = <K extends keyof AssignForm>(key: K, value: AssignForm[K]) => setSubmit((s) => ({ ...s, [key]: value }))

  return (
    <>
      {cloneElement(children, { onClick: toggle })}
      <Modal
        title="订单分配"
        open={visible}
        onCancel={toggle}
        onOk={() => void useOrderManageStore.getState().assign({ ...submit }, toggle)}
        okText={assignLoading ? <LoadingOutlined /> : '确定'}
        cancelText="取消"
      >
        <FormGroup label="用户邮箱">
          <Input placeholder="请输入用户邮箱" value={submit.email} onChange={(e) => change('email', e.target.value)} />
        </FormGroup>
        <FormGroup label="请选择订阅">
          <div>
            <Select<number>
              value={submit.plan_id}
              style={{ width: '100%' }}
              placeholder="请选择订阅"
              options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
              onChange={(value) => change('plan_id', value)}
            />
          </div>
        </FormGroup>
        <FormGroup label="请选择周期">
          <div>
            <Select<string>
              value={submit.period}
              style={{ width: '100%' }}
              placeholder="请选择周期"
              options={PERIOD_OPTIONS}
              onChange={(value) => change('period', value)}
            />
          </div>
        </FormGroup>
        <FormGroup label="支付金额">
          <Input
            placeholder="请输入需要支付的金额"
            addonAfter="¥"
            value={submit.total_amount}
            onChange={(e) => change('total_amount', e.target.value)}
          />
        </FormGroup>
      </Modal>
    </>
  )
}
