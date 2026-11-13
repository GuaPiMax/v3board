// 创建用户弹窗（原版模块 Qg4q）：填写账号时创建一个用户，账号留空、填写生成数量时批量生成（下载 CSV）。与原版一致：
//   - 填了生成数量就隐藏账号输入框，填了账号就隐藏生成数量
//   - 关闭弹窗（或生成成功）后表单清空，日期选择也一起清空
//     （原版日期选择是非受控的，清空后仍显示上次选的日期、提交时却不再带上，有意修正）
import { DatePicker, Input, Modal, Select } from 'antd'
import dayjs from 'dayjs'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { CACHED_ONLY, usePlans } from '@/api/queries'
import { useUi } from '@/stores/appearance'
import { useUserManageStore } from '@/stores/userManage'

// 邮箱中间的「@」框（宽 10%）：皮肤（antd 6 观感）下不留左右内边距。它们的弹窗内容区更窄，
// antd 6 输入框左右各 11px 的内边距会把「@」挤出去一截（legacy 放得下，保持原样）
const AT_STYLE = { width: '10%', textAlign: 'center' } as const
const SKIN_AT_STYLE = { ...AT_STYLE, paddingInline: 0 } as const

interface GenerateForm {
  email_prefix?: string
  email_suffix?: string
  password?: string
  expired_at?: string | null
  plan_id?: number | null
  generate_count?: string
}

export function CreateUserModal({ children }: { children: ReactElement<{ onClick?: MouseEventHandler }> }) {
  const [visible, setVisible] = useState(false)
  const [submit, setSubmit] = useState<GenerateForm>({})
  const generateLoading = useUserManageStore((s) => s.generateLoading)
  const { data: plans = [] } = usePlans(CACHED_ONLY)
  const atStyle = useUi() === 'legacy' ? AT_STYLE : SKIN_AT_STYLE

  const hide = () => {
    setVisible(false)
    setSubmit({})
  }
  const change = <K extends keyof GenerateForm>(key: K, value: GenerateForm[K]) => setSubmit((s) => ({ ...s, [key]: value }))

  return (
    <>
      {cloneElement(children, { onClick: () => setVisible(true) })}
      <Modal
        title="创建用户"
        open={visible}
        onCancel={hide}
        cancelText="取消"
        onOk={() => void useUserManageStore.getState().generate({ ...submit }, hide)}
        okButtonProps={{ loading: generateLoading }}
        okText="生成"
      >
        <div>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">邮箱</label>
            <Input.Group compact>
              {!submit.generate_count && (
                <Input
                  placeholder="账号（批量生成请留空）"
                  style={{ width: '45%' }}
                  value={submit.email_prefix}
                  onChange={(e) => change('email_prefix', e.target.value)}
                />
              )}
              <Input placeholder="@" style={atStyle} disabled />
              <Input
                placeholder="域"
                style={{ width: '45%' }}
                value={submit.email_suffix}
                onChange={(e) => change('email_suffix', e.target.value)}
              />
            </Input.Group>
          </div>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">密码</label>
            <Input
              value={submit.password}
              placeholder="留空则密码与邮箱相同"
              onChange={(e) => change('password', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">到期时间</label>
            <div>
              <DatePicker
                value={submit.expired_at ? dayjs.unix(Number(submit.expired_at)) : null}
                placeholder="请选择用户到期日期，为空则不限制到期时间"
                style={{ width: '100%' }}
                onChange={(date) => change('expired_at', date ? String(date.unix()) : null)}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="example-text-input-alt">订阅计划</label>
            <Select<number | null>
              placeholder="请选择用户订阅计划"
              style={{ width: '100%' }}
              value={submit.plan_id || null}
              options={[{ value: null, label: '无' }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]}
              onChange={(value) => change('plan_id', value)}
            />
          </div>
          {!submit.email_prefix && (
            <div className="form-group">
              <label htmlFor="example-text-input-alt">生成数量</label>
              <Input
                value={submit.generate_count}
                placeholder="如果为批量生成请输入生成数量"
                onChange={(e) => change('generate_count', e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
