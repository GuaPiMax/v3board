import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { App } from 'antd'
import { useLayoutEffect } from 'react'
import type { MessageInstance } from 'antd/es/message/interface'
import type { ModalStaticFunctions } from 'antd/es/modal/confirm'
import type { NotificationInstance } from 'antd/es/notification/interface'
import type { ReactNode } from 'react'
import { getUi } from '@/stores/appearance'

// antd 6 的静态方法拿不到 ConfigProvider 的主题，这里通过 <App> 的 hook 取实例，
// 供请求层等非组件代码调用（与原版 notification / message / Modal.info 行为一致）。
let messageApi: MessageInstance | undefined
let notificationApi: NotificationInstance | undefined
let modalApi: Omit<ModalStaticFunctions, 'warn'> | undefined

export function StaticApiHolder() {
  const api = App.useApp()
  // 布局副作用先于页面里的数据请求（普通副作用）执行，保证请求出错时实例已就绪
  useLayoutEffect(() => {
    messageApi = api.message
    notificationApi = api.notification
    modalApi = api.modal
  }, [api])
  return null
}

function ensure<T>(api: T | undefined): T {
  if (!api) throw new Error('StaticApiHolder 尚未挂载')
  return api
}

export const message = {
  success: (content: string) => ensure(messageApi).success(content),
  error: (content: string) => ensure(messageApi).error(content),
  warning: (content: string) => ensure(messageApi).warning(content),
  loading: (content: string) => ensure(messageApi).loading(content),
  destroy: () => ensure(messageApi).destroy(),
}

// legacy：antd 3 的错误通知用线框图标（antd 6 为实心）；自定义图标时 antd 6 不再给图标容器加类型颜色类，这里补上
export const notification = {
  error: (config: Parameters<NotificationInstance['error']>[0]) =>
    ensure(notificationApi).error({
      ...(getUi() === 'legacy'
        ? { icon: <CloseCircleOutlined />, classNames: { icon: 'ant-notification-notice-icon-error' } }
        : {}),
      ...config,
    }),
}

// legacy 预设与 antd 3 一致使用线框图标（antd 6 默认是实心图标）
type ModalConfig = Parameters<ModalStaticFunctions['info']>[0]
const legacyIcon = (icon: ReactNode) => (getUi() === 'legacy' ? { icon } : {})
export const modal = {
  info: (config: ModalConfig) => ensure(modalApi).info({ ...legacyIcon(<InfoCircleOutlined />), ...config }),
  confirm: (config: ModalConfig) => ensure(modalApi).confirm({ ...legacyIcon(<QuestionCircleOutlined />), ...config }),
  success: (config: ModalConfig) => ensure(modalApi).success({ ...legacyIcon(<CheckCircleOutlined />), ...config }),
  error: (config: ModalConfig) => ensure(modalApi).error({ ...legacyIcon(<CloseCircleOutlined />), ...config }),
  // v3board：补充 warning（上游只有 info / confirm / success / error）
  warning: (config: ModalConfig) =>
    ensure(modalApi).warning({ ...legacyIcon(<ExclamationCircleOutlined />), ...config }),
}
