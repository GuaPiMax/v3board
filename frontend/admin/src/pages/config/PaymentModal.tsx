import { Input, Modal, Select } from 'antd'
import { cloneElement, useRef, useState, type MouseEventHandler, type ReactElement } from 'react'
import type { Payment, PaymentForm } from '@/api/types'
import { usePaymentManageStore } from '@/stores/paymentManage'

type PaymentSubmit = Partial<Payment> & Record<string, unknown>

interface PaymentModalProps {
  record?: Payment
  /** 点击后打开弹窗的元素（原版用 cloneElement 覆盖它的 onClick） */
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

/** 配置表单里已有的值（编辑时为已保存的配置） */
const formValues = (form: PaymentForm) =>
  Object.fromEntries(
    Object.entries(form).flatMap(([key, field]) => (field.value === undefined || field.value === null ? [] : [[key, field.value]])),
  )

// 添加 / 编辑支付方式弹窗（原版 eIZb 里的组件 w）。与原版一致：
//   - 表单内容只在组件创建时从 record 初始化，输入框只用初始值，关闭后不重置（再次打开仍是上次填写的内容）
//   - 每次打开都重新读取支付接口列表，并按选中的接口读取配置表单；接口列表以 Paytaro 开头，添加时默认选第一个
// 有意修正（与原版行为不同）：
//   - 保存请求期间「保存 / 添加」显示加载中、不能重复提交（原版加载状态只跟随列表刷新，连点会提交两次）
//   - 添加成功后清空弹窗（原版不清空，再点「添加支付方式」显示上次的内容，直接提交会再建一个）
//   - 切换「接口文件」后按新接口的字段重建输入框，提交的配置也换成新接口的字段（原版按位置复用输入框，
//     显示的是之前接口的值，之前接口的配置也一起提交）
//   - 固定手续费按「元 × 100」四舍五入成分（原版不取整，1.1 元会提交 110.00000000000001，后端提示格式有误）
export function PaymentModal({ record, children }: PaymentModalProps) {
  const fetchLoading = usePaymentManageStore((s) => s.fetchLoading)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submit, setSubmit] = useState<PaymentSubmit>(() => ({ ...record }))
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [selectPaymentMethod, setSelectPaymentMethod] = useState<string | undefined>()
  const [form, setForm] = useState<PaymentForm>({})
  const [config, setConfig] = useState<Record<string, string>>(() => record?.config || {})
  /** 添加成功后，弹窗关闭动画结束时清空（换一个 key 重建里面的输入框） */
  const [formKey, setFormKey] = useState(0)
  const resetAfterClose = useRef(false)

  /** switched：在「接口文件」里换了接口，配置改为新接口表单里的值 */
  const onSelectPaymentMethod = async (payment: string | undefined, switched = false) => {
    const data = await usePaymentManageStore.getState().getPaymentForm(payment, submit.id)
    if (!data) return
    setForm(data)
    setSelectPaymentMethod(payment)
    if (switched) setConfig(formValues(data))
  }

  const show = async () => {
    const methods = await usePaymentManageStore.getState().getPaymentMethods()
    if (!methods) return
    const method = selectPaymentMethod || submit.payment || methods[0]
    setVisible(true)
    setPaymentMethods(methods)
    setSelectPaymentMethod(method)
    void onSelectPaymentMethod(method)
  }

  /** 正在保存（连续点击时 state 可能还没更新，用 ref 判断） */
  const savingRef = useRef(false)
  const save = async () => {
    // 保存中或弹窗正在关闭（保存成功后的关闭动画期间按钮仍可点）时不再提交
    if (savingRef.current || !visible) return
    savingRef.current = true
    setSaving(true)
    await usePaymentManageStore.getState().save({ ...submit, payment: selectPaymentMethod, config }, () => {
      setVisible(false)
      if (!submit.id) resetAfterClose.current = true
    })
    savingRef.current = false
    setSaving(false)
  }

  const reset = () => {
    setSubmit({})
    setPaymentMethods([])
    setSelectPaymentMethod(undefined)
    setForm({})
    setConfig({})
    setFormKey((key) => key + 1)
  }

  const submitOnChange = (key: string, value: unknown) => setSubmit((s) => ({ ...s, [key]: value }))
  const configOnChange = (key: string, value: string) => setConfig((c) => ({ ...c, [key]: value }))

  return (
    <>
      {cloneElement(children, { onClick: () => void show() })}
      <Modal
        title={submit.id ? '编辑支付方式' : '添加支付方式'}
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => void save()}
        okText={submit.id ? '保存' : '添加'}
        okButtonProps={{ loading: saving || fetchLoading }}
        cancelText="取消"
        afterClose={() => {
          if (!resetAfterClose.current) return
          resetAfterClose.current = false
          reset()
        }}
      >
        <div key={formKey}>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">显示名称</label>
            <Input
              placeholder="用于前端显示使用"
              defaultValue={submit.name}
              onChange={(e) => submitOnChange('name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">图标URL(选填)</label>
            <Input
              placeholder="用于前端显示使用(https://x.com/icon.svg)"
              defaultValue={submit.icon ?? undefined}
              onChange={(e) => submitOnChange('icon', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">自定义通知域名(选填)</label>
            <Input
              placeholder="网关的通知将会发送到该域名(https://x.com)"
              defaultValue={submit.notify_domain ?? undefined}
              onChange={(e) => submitOnChange('notify_domain', e.target.value)}
            />
          </div>
          <div className="row">
            <div className="col-6">
              <div className="form-group">
                <label htmlFor="example-text-input-alt">百分比手续费(选填)</label>
                <Input
                  suffix="%"
                  type="number"
                  placeholder="在订单金额基础上附加手续费"
                  defaultValue={submit.handling_fee_percent ?? undefined}
                  onChange={(e) => submitOnChange('handling_fee_percent', e.target.value)}
                />
              </div>
            </div>
            <div className="col-6">
              <div className="form-group">
                <label htmlFor="example-text-input-alt">固定手续费(选填)</label>
                {/* 与原版一致显示为元（没有设置时为 0，添加时为空）；提交时换算成分并四舍五入 */}
                <Input
                  type="number"
                  placeholder="在订单金额基础上附加手续费"
                  defaultValue={Number(submit.handling_fee_fixed) / 100}
                  onChange={(e) => submitOnChange('handling_fee_fixed', Math.round(100 * Number(e.target.value)))}
                />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">接口文件</label>
            <div>
              <Select<string>
                style={{ width: '100%' }}
                defaultValue={selectPaymentMethod}
                onChange={(value) => void onSelectPaymentMethod(value, true)}
                options={paymentMethods.map((method) => ({ value: method, label: method }))}
              />
            </div>
          </div>
          {Object.keys(form).map((key) => {
            const field = form[key]
            const isInput = !field.type || ['input', 'text', 'string'].includes(field.type)
            return (
              // 按接口与字段区分：换了接口后重建输入框，显示新接口的值
              <div key={`${selectPaymentMethod}:${key}`} className="form-group">
                <label htmlFor="example-text-input-alt">{field.label}</label>
                {isInput && (
                  <Input
                    placeholder={field.description}
                    defaultValue={config[key] || field.value}
                    onChange={(e) => configOnChange(key, e.target.value)}
                  />
                )}
              </div>
            )
          })}
          {selectPaymentMethod?.includes('Paytaro') && (
            <div className="alert alert-warning mb-0" role="alert">
              <p className="mb-0">
                客服TG
                <a href="https://t.me/paytaro" target="_blank" rel="noopener noreferrer">
                  @paytaro
                </a>
                <br />
                机器人
                <a href="https://t.me/paytarorobot" target="_blank" rel="noopener noreferrer">
                  @paytarorobot
                </a>
                <br />
                官方网站
                <a href="https://v3.paytaro.com/#/docs" target="_blank" rel="noopener noreferrer">
                  https://v3.paytaro.com
                </a>
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
