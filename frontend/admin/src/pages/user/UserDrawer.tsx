// 用户编辑抽屉（原版模块 CgOb；用户管理的行菜单 / 右键菜单、工单详情的「用户管理」图标）。与原版一致：
//   - 打开时按 id 读取用户（没有 id 时点击无反应），读取完成前显示加载图标；关闭时清空（关闭动画中也是加载图标）。
//     是否读取完成按 id 判断（原版按邮箱判断，清空邮箱时整个表单变成加载图标，有意修正）
//   - 用户数据在 userManage 里（所有编辑抽屉共用），表单是非受控输入，初始内容在读取完成时确定
//   - 提交整条记录，成功后刷新列表（不等待）并关闭
import { LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { Button, DatePicker, Drawer, Input, Select, Switch, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { CACHED_ONLY, usePlans } from '@/api/queries'
import { FormGroup } from '@/components/FormGroup'
import { useUserManageStore } from '@/stores/userManage'

const BANNED_OPTIONS = [
  { value: 1, label: '封禁' },
  { value: 0, label: '正常' },
]
const COMMISSION_TYPE_OPTIONS = [
  { value: 0, label: '跟随系统设置' },
  { value: 1, label: '循环返利' },
  { value: 2, label: '首次返利' },
]

interface UserDrawerProps {
  userId?: number
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

/** 输入框的初始值（null 显示为空） */
const initial = (value: unknown) => (value ?? undefined) as string | undefined

/** 修改一个字段（写入 userManage 里的 user） */
function change(key: string, value: unknown) {
  const store = useUserManageStore.getState()
  store.setState({ user: { ...store.user, [key]: value } })
}

export function UserDrawer({ userId, children }: UserDrawerProps) {
  const [visible, setVisible] = useState(false)
  const user = useUserManageStore((s) => s.user)
  const updateLoading = useUserManageStore((s) => s.updateLoading)
  const { data: plans = [] } = usePlans(CACHED_ONLY)
  // v3board：距下次流量重置天数（null 为不重置或订阅无效）
  const resetDay = user.reset_day as number | null | undefined

  const show = () => {
    if (!userId) return
    setVisible(true)
    void useUserManageStore.getState().getUserInfoById(userId)
  }
  const hide = () => {
    setVisible(false)
    useUserManageStore.getState().setState({ user: {}, loadedUser: {} })
  }
  const submit = () => {
    const store = useUserManageStore.getState()
    void store.update({ ...store.user }, hide)
  }

  return (
    <>
      {cloneElement(children, { onClick: show })}
      <Drawer id="user" size="80%" title="用户管理" open={visible} onClose={hide}>
        {user.id ? (
          <div>
            <div>
              <FormGroup label="邮箱">
                <Input
                  placeholder="请输入邮箱"
                  defaultValue={initial(user.email)}
                  onChange={(e) => change('email', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="邀请人邮箱">
                <Input
                  placeholder="请输入邀请人邮箱"
                  defaultValue={initial(user.invite_user_email)}
                  onChange={(e) => change('invite_user_email', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="密码">
                <Input
                  defaultValue={initial(user.password)}
                  placeholder="如需修改密码请输入"
                  onChange={(e) => change('password', e.target.value)}
                />
              </FormGroup>
              <div className="row">
                <div className="form-group col-md-6 col-xs-12">
                  <label>余额</label>
                  <Input
                    type="number"
                    addonAfter="¥"
                    placeholder="余额"
                    defaultValue={initial(user.balance)}
                    onChange={(e) => change('balance', e.target.value)}
                  />
                </div>
                <div className="form-group col-md-6 col-xs-12">
                  <label>推广佣金</label>
                  <Input
                    type="number"
                    addonAfter="¥"
                    placeholder="推广佣金"
                    defaultValue={initial(user.commission_balance)}
                    onChange={(e) => change('commission_balance', e.target.value)}
                  />
                </div>
              </div>
              <div className="row">
                <div className="form-group col-md-6 col-xs-12">
                  <label>已用上行</label>
                  <Input
                    type="number"
                    addonAfter="GB"
                    placeholder="已用上行"
                    defaultValue={initial(user.u)}
                    onChange={(e) => change('u', e.target.value)}
                  />
                </div>
                <div className="form-group col-md-6 col-xs-12">
                  <label>已用下行</label>
                  <Input
                    type="number"
                    addonAfter="GB"
                    placeholder="已用下行"
                    defaultValue={initial(user.d)}
                    onChange={(e) => change('d', e.target.value)}
                  />
                </div>
              </div>
              <FormGroup label="流量">
                <Input
                  type="number"
                  addonAfter="GB"
                  defaultValue={initial(user.transfer_enable)}
                  placeholder="请输入流量"
                  onChange={(e) => change('transfer_enable', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="设备数限制">
                <Input
                  placeholder="留空则不限制"
                  defaultValue={initial(user.device_limit)}
                  onChange={(e) => change('device_limit', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="到期时间">
                <div>
                  <DatePicker
                    placeholder="长期有效"
                    defaultValue={user.expired_at !== null ? dayjs(Number(user.expired_at) * 1000) : undefined}
                    style={{ width: '100%' }}
                    onChange={(date) => change('expired_at', date ? String(date.unix()) : null)}
                  />
                  {resetDay !== null && resetDay !== undefined && (
                    <small className="text-muted">
                      {resetDay === 0 ? '不足 1 天后重置流量' : `距下次流量重置还有 ${resetDay} 天`}
                    </small>
                  )}
                </div>
              </FormGroup>
              <FormGroup label="订阅计划">
                <Select<number | null>
                  placeholder="请选择用户订阅计划"
                  style={{ width: '100%' }}
                  defaultValue={(user.plan_id as number | null) || null}
                  options={[{ value: null, label: '无' }, ...plans.map((plan) => ({ value: plan.id, label: plan.name }))]}
                  onChange={(value) => change('plan_id', value)}
                />
              </FormGroup>
              <FormGroup label="账户状态">
                <Select<number>
                  style={{ width: '100%' }}
                  defaultValue={user.banned ? 1 : 0}
                  options={BANNED_OPTIONS}
                  onChange={(value) => change('banned', value)}
                />
              </FormGroup>
              <FormGroup label="推荐返利类型">
                <Select<number>
                  style={{ width: '100%' }}
                  defaultValue={Number.parseInt(String(user.commission_type), 10)}
                  options={COMMISSION_TYPE_OPTIONS}
                  onChange={(value) => change('commission_type', value)}
                />
              </FormGroup>
              <FormGroup label="推荐返利比例">
                <Input
                  addonAfter="%"
                  defaultValue={initial(user.commission_rate)}
                  placeholder="请输入推荐返利比例(为空则跟随站点设置返利比例)"
                  onChange={(e) => change('commission_rate', e.target.value)}
                />
              </FormGroup>
              <FormGroup
                label={
                  <>
                    专享折扣比例{' '}
                    <Tooltip placement="top" title="设置后该用户购买任何订阅将始终享受该折扣">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </>
                }
              >
                <Input
                  addonAfter="%"
                  defaultValue={initial(user.discount)}
                  placeholder="请输入专享折扣比例"
                  onChange={(e) => change('discount', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="限速">
                <Input
                  addonAfter="Mbps"
                  defaultValue={initial(user.speed_limit)}
                  placeholder="留空则不限制"
                  onChange={(e) => change('speed_limit', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="是否管理员">
                <div>
                  <Switch checked={Boolean(user.is_admin)} onChange={(checked) => change('is_admin', checked ? 1 : 0)} />
                </div>
              </FormGroup>
              <FormGroup label="是否员工">
                <div>
                  <Switch checked={Boolean(user.is_staff)} onChange={(checked) => change('is_staff', checked ? 1 : 0)} />
                </div>
              </FormGroup>
              <FormGroup label="备注">
                <div>
                  <Input.TextArea
                    rows={4}
                    placeholder="请在这里记录.."
                    defaultValue={initial(user.remarks)}
                    onChange={(e) => change('remarks', e.target.value)}
                  />
                </div>
              </FormGroup>
            </div>
            <div className="v2board-drawer-action">
              <Button style={{ marginRight: 8 }} onClick={hide}>
                取消
              </Button>
              <Button disabled={updateLoading} loading={updateLoading} onClick={submit} type="primary">
                提交
              </Button>
            </div>
          </div>
        ) : (
          <LoadingOutlined style={{ fontSize: 24, color: 'var(--v2b-loading, #415A94)' }} />
        )}
      </Drawer>
    </>
  )
}
