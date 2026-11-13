// 人工审核弹窗（「概览」风险用户表的「审核」、「用户详情」的「审核此用户」）。
// 持续观察 / 解除疑虑 / 建议限制：只记一条审核记录，不改账号。
// 限制：不封号，之后该用户拉订阅时所有节点的入口地址换成假地址（风控设置里未填时按用户自动生成），需勾选确认、原因至少 12 字；
// 解除限制：恢复真实入口，只对限制中的用户显示（后端对未限制的用户返回 422）。两者都会留审核记录。
// 与项目里其他弹窗一样包住触发元素，点击打开；关闭动画结束后表单恢复初始值
import { Checkbox, Input, Modal, Select, Tag } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { releaseGuardUser, restrictGuardUser, saveGuardReview } from '@/api/services/insiderGuard'
import type { GuardReviewAction } from '@/api/types'
import { message } from '@/app/staticApi'
import { FormGroup } from '@/components/FormGroup'
import { MUTED, Note, REVIEW_ACTION_TEXT, userLabel } from './shared'

const ACTIONS: GuardReviewAction[] = ['watch', 'clear', 'restrict_recommended', 'restrict', 'release']
const ACTION_OPTIONS = ACTIONS.map((value) => ({ value, label: REVIEW_ACTION_TEXT[value] }))
/** 未被限制的用户没有「解除限制」可选；当前已选中 release 时保留它（解除成功后关闭动画里 restricted 已变为 false） */
const actionOptions = (restricted: boolean | undefined, current: GuardReviewAction) =>
  restricted || current === 'release' ? ACTION_OPTIONS : ACTION_OPTIONS.filter((option) => option.value !== 'release')

/** 原因的最少字数（与后端一致：限制 12，其余 8）与上限；字数按码点算，与后端 mb_strlen 一致 */
const REASON_MIN: Record<GuardReviewAction, number> = {
  watch: 8,
  clear: 8,
  restrict_recommended: 8,
  restrict: 12,
  release: 8,
}
const REASON_MAX = 1000
const REASON_EXAMPLE: Record<GuardReviewAction, string> = {
  watch: '短时间内多个 IP 频繁拉取订阅，先观察',
  clear: '已与用户确认为多设备自用',
  restrict_recommended: '订阅疑似外泄，建议限制',
  restrict: '订阅已在公开渠道流传，限制后观察投诉情况',
  release: '用户已更换订阅并说明情况，解除限制',
}
const placeholder = (action: GuardReviewAction) => `至少 ${REASON_MIN[action]} 个字，例如：${REASON_EXAMPLE[action]}`

export interface ReviewUser {
  id: number
  email?: string | null
  /** 当前是否被限制（拉订阅时下发假入口） */
  restricted?: boolean
  /** 一行风险摘要，例如「最近 1 小时：评分 25，订阅 30 次，IP 2 个」 */
  summary?: string
}

interface ReviewModalProps {
  user: ReviewUser
  /** 保存成功后：刷新概览（审核总数、限制中账号）、风险用户表（限制标记）与用户详情（审核记录、限制状态） */
  onSaved: () => void
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

export function ReviewModal({ user, onSaved, children }: ReviewModalProps) {
  const [visible, setVisible] = useState(false)
  const [action, setAction] = useState<GuardReviewAction>('watch')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)

  const close = () => setVisible(false)
  /** 关闭动画结束后再重置，避免关闭过程中内容跳变 */
  const reset = () => {
    setAction('watch')
    setReason('')
    setConfirmed(false)
  }

  const submit = async () => {
    const text = reason.trim()
    const length = [...text].length
    if (length < REASON_MIN[action]) return message.error(`原因至少 ${REASON_MIN[action]} 个字`)
    if (length > REASON_MAX) return message.error(`原因不能超过 ${REASON_MAX} 字`)
    if (action === 'restrict' && !confirmed) return message.error('请先勾选确认限制')
    setSaving(true)
    const res =
      action === 'restrict'
        ? await restrictGuardUser({ id: user.id, reason: text })
        : action === 'release'
          ? await releaseGuardUser({ id: user.id, reason: text })
          : await saveGuardReview({ id: user.id, action, reason: text })
    setSaving(false)
    if (res.code !== 200 || res.data !== true) return
    message.success(
      action === 'restrict' ? '已限制，该用户下次拉取订阅即生效' : action === 'release' ? '已解除限制' : '审核已保存',
    )
    close()
    onSaved()
  }

  return (
    <>
      {cloneElement(children, {
        onClick: () => {
          // 理论上不会：动作还停在「解除限制」而用户已不在限制中，回到「持续观察」
          if (action === 'release' && !user.restricted) setAction('watch')
          setVisible(true)
        },
      })}
      <Modal
        title="人工审核"
        open={visible}
        onCancel={close}
        afterClose={reset}
        onOk={() => void submit()}
        okText={action === 'restrict' ? '确认限制' : action === 'release' ? '解除限制' : '保存审核'}
        okButtonProps={{ loading: saving, danger: action === 'restrict' }}
        cancelText="取消"
        // 提交中不能关闭：避免请求还在进行时弹窗已经关掉、结果无处提示
        mask={{ closable: false }}
        keyboard={!saving}
        closable={!saving}
        cancelButtonProps={{ disabled: saving }}
      >
        <FormGroup label="用户">
          <div>
            {userLabel(user.email, user.id)}
            {user.email && <span style={MUTED}> #{user.id}</span>}
            {user.restricted ? (
              <Tag color="red" style={{ marginLeft: 8 }}>
                已限制
              </Tag>
            ) : (
              <Tag style={{ marginLeft: 8 }}>未限制</Tag>
            )}
          </div>
          {user.summary && <Note>{user.summary}</Note>}
        </FormGroup>
        <FormGroup label="动作">
          <div>
            <Select<GuardReviewAction>
              style={{ width: '100%' }}
              value={action}
              options={actionOptions(user.restricted, action)}
              onChange={(value) => {
                setAction(value)
                setConfirmed(false)
              }}
            />
          </div>
        </FormGroup>
        {action === 'restrict' && (
          <div className="alert alert-warning" role="alert" style={{ marginBottom: 16 }}>
            <p className="mb-2">
              限制不封号：该用户的账号、凭据、节点列表都不变，只是之后拉取的订阅里所有节点入口都换成假入口地址（风控设置里未填时按用户自动生成），
              泄露出去的订阅拿不到真实入口；登录后的用户面板不受影响。解除限制后恢复。
            </p>
            <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}>
              我确认限制该用户
            </Checkbox>
          </div>
        )}
        {action === 'restrict' && user.restricted && (
          <Note style={{ marginBottom: 16 }}>该用户已处于限制中，这次只会更新原因并再记一条审核记录。</Note>
        )}
        <FormGroup label="原因">
          <Input.TextArea
            rows={4}
            placeholder={placeholder(action)}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </FormGroup>
        <Note>所有动作都会记入该用户的审核记录；账号封禁请在用户管理中经独立确认后操作。</Note>
      </Modal>
    </>
  )
}
