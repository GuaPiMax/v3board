// 发送邮件弹窗（原版模块 maVC）：收件人为当前过滤条件下的用户（没有过滤条件时为全部用户）。
// 与原版一致，发送成功后关闭但不清空主题和内容
import { Input, Modal } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { FormGroup } from '@/components/FormGroup'
import { useUserManageStore } from '@/stores/userManage'

export function SendMailModal({ children }: { children: ReactElement<{ onClick?: MouseEventHandler }> }) {
  const [visible, setVisible] = useState(false)
  const [submit, setSubmit] = useState<{ subject?: string; content?: string }>({})
  // 与原版一样随 userManage 的任何变化重新渲染（过滤器抽屉直接修改条件数组，收件人显示在下次渲染时更新）
  const { filter, sendMailLoading } = useUserManageStore()

  return (
    <>
      {cloneElement(children, { onClick: () => setVisible(true) })}
      {/* 层级固定为 antd 3 的 1000（入口在 Tips 提示里的下拉菜单中，见 FilterDrawer） */}
      <Modal
        title="发送邮件"
        zIndex={1000}
        open={visible}
        onOk={() => void useUserManageStore.getState().sendMail(submit, () => setVisible(false))}
        okButtonProps={{ loading: sendMailLoading }}
        onCancel={() => setVisible(false)}
      >
        <FormGroup label="收件人">
          <Input disabled value={filter.length ? '过滤用户' : '全部用户'} />
        </FormGroup>
        <FormGroup label="主题">
          <Input
            placeholder="请输入邮件主题"
            value={submit.subject}
            onChange={(e) => setSubmit({ ...submit, subject: e.target.value })}
          />
        </FormGroup>
        <FormGroup label="发送内容">
          <Input.TextArea
            rows={12}
            value={submit.content}
            placeholder="请输入邮件内容"
            onChange={(e) => setSubmit({ ...submit, content: e.target.value })}
          />
        </FormGroup>
      </Modal>
    </>
  )
}
