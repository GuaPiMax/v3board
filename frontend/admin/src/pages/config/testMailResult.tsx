import type { TestMailLog } from '@/api/types'
import { modal } from '@/app/staticApi'

/** 发送测试邮件的结果（原版 model config 的 testSendMail：失败用错误弹窗并显示原因，成功用成功弹窗） */
export function showTestMailResult(log: TestMailLog | undefined) {
  const failed = Boolean(log?.error)
  modal[failed ? 'error' : 'success']({
    title: failed ? '发送失败' : '发送成功',
    content: (
      <div>
        {log?.error && (
          <div>
            <span>失败原因:</span>
            <span>{log.error}</span>
          </div>
        )}
        <div>
          <span>收信地址:</span>
          <span>{log?.email}</span>
        </div>
        <div>
          <span>发信服务器:</span>
          <span>{log?.config?.host}</span>
        </div>
        <div>
          <span>发信端口:</span>
          <span>{log?.config?.port}</span>
        </div>
        <div>
          <span>发信加密方式:</span>
          <span>{log?.config?.encryption}</span>
        </div>
        <div>
          <span>发信用户名:</span>
          <span>{log?.config?.username}</span>
        </div>
      </div>
    ),
  })
}
