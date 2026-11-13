// 工单对话（原版模块 FPmv，路由 /ticket/:ticket_id，从工单列表以 800×600 的新窗口打开，没有管理端框架）。与原版一致：
//   - 进入时读取工单与订阅列表，之后每 5 秒重新读取工单；消息条数变化时滚动到底部
//   - 回车发送（发送中忽略），成功后清空输入框与记下的内容（原版只清空输入框，直接再按回车会把上一条消息
//     再发一次，有意修正）
//   - 顶部右侧：用户管理抽屉、流量记录
//   - antd 组件是英文（见 LEGACY_EN_US）
import { SolutionOutlined, UserOutlined } from '@ant-design/icons'
import { Button, ConfigProvider, Divider, Tooltip } from 'antd'
import type { Locale } from 'antd/es/locale'
import enUS from 'antd/locale/en_US'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { usePlans } from '@/api/queries'
import { useTicketManageStore } from '@/stores/ticketManage'
import { formatTime } from '@/utils/format'
import { TrafficLogModal } from '../user/TrafficLogModal'
import { UserDrawer } from '../user/UserDrawer'

// 原版 CSS Modules（umi.css 中的 content___DW5w1 等），样式写在 v2board.scss
const styles = { content: 'content___DW5w1', input: 'input___1j_ND', tag: 'tag___12_9H', ctrl: 'ctrl___UqDJ7' }

// 与原版一致：antd 的中文语言包由管理端框架提供，工单对话页不在框架里，antd 组件使用默认的英文
// （例如流量记录为空时显示 antd 3 的「No Data」）
// （antd/locale/* 是 CommonJS，开发环境的互操作对象多一层 default；ConfigProvider 看到 default 会直接使用它，
// 所以先取出语言包本身再覆盖）
const EN_US: Locale = (enUS as Locale & { default?: Locale }).default ?? enUS
const LEGACY_EN_US: Locale = { ...EN_US, Table: { ...EN_US.Table, emptyText: 'No Data' }, Empty: { description: 'No Data' } }

export default function TicketChatPage() {
  return (
    <ConfigProvider locale={LEGACY_EN_US}>
      <TicketChat />
      {/* 暗黑模式（darkreader）对页面加载之后才注入的 antd 按钮样式处理不完整（主按钮背景经由 --ant-btn-bg-color 引用主题色，
          会变成透明）。这个页面加载时没有按钮，到打开「用户管理」抽屉才注入，这里先渲染一个隐藏的按钮 */}
      <Button type="primary" style={{ display: 'none' }} aria-hidden tabIndex={-1} />
    </ConfigProvider>
  )
}

function TicketChat() {
  const { ticket_id: ticketId = '' } = useParams()
  const ticket = useTicketManageStore((s) => s.ticket)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<string | undefined>(undefined)
  const chatCount = useRef(0)
  const mounted = useRef(false)
  usePlans()

  useEffect(() => {
    const store = useTicketManageStore.getState()
    void store.fetchById(ticketId)
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      timer = setTimeout(() => {
        void useTicketManageStore.getState().fetchById(ticketId)
        check()
      }, 5000)
    }
    check()
    return () => clearTimeout(timer)
  }, [ticketId])

  // 与原版 componentDidMount / componentDidUpdate 一致：首次渲染时、之后消息条数变化时滚到底部
  useLayoutEffect(() => {
    const scroll = () => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight)
    if (!mounted.current) {
      mounted.current = true
      scroll()
      return
    }
    const count = ticket?.message.length ?? 0
    if (chatCount.current === count) return
    chatCount.current = count
    scroll()
  })

  const reply = () => {
    void useTicketManageStore.getState().reply(ticketId, messageRef.current, () => {
      if (inputRef.current) inputRef.current.value = ''
      messageRef.current = undefined
    })
  }

  return (
    <div>
      <div className="block-content-full bg-gray-lighter p-3">
        <span className={styles.tag}>{ticket?.subject}</span>
        <div className={styles.ctrl}>
          <UserDrawer userId={ticket?.user_id}>
            <Tooltip title="用户管理" placement="left">
              <UserOutlined />
            </Tooltip>
          </UserDrawer>
          <Divider orientation="vertical" />
          <TrafficLogModal userId={ticket?.user_id} key={ticket?.user_id}>
            <Tooltip title="TA的流量记录" placement="left">
              <SolutionOutlined />
            </Tooltip>
          </TrafficLogModal>
        </div>
      </div>
      <div
        className={`bg-white js-chat-messages block-content block-content-full text-wrap-break-word overflow-y-auto ${styles.content}`}
        ref={chatRef}
      >
        {ticket?.message.map((item) =>
          item.is_me ? (
            <div key={item.id}>
              <div className="font-size-sm text-muted my-2 text-right">{formatTime(item.created_at)}</div>
              <div className="text-right ml-4">
                <div className="d-inline-block bg-gray-lighter px-3 py-2 mb-2 mw-100 rounded text-left">{item.message}</div>
              </div>
            </div>
          ) : (
            <div key={item.id}>
              <div className="font-size-sm text-muted my-2">{formatTime(item.created_at)}</div>
              <div className="mr-4">
                <div className="d-inline-block bg-success-lighter px-3 py-2 mb-2 mw-100 rounded text-left">
                  {item.message}
                </div>
              </div>
            </div>
          ),
        )}
      </div>
      <div className={`js-chat-form block-content p-2 bg-body-dark ${styles.input}`}>
        <input
          ref={inputRef}
          type="text"
          className="js-chat-input bg-body-dark border-0 form-control form-control-alt"
          placeholder="输入内容回复工单..."
          onKeyDown={(e) => {
            if (e.keyCode === 13 && !useTicketManageStore.getState().replyLoading) reply()
          }}
          onChange={(e) => {
            messageRef.current = e.target.value
          }}
        />
      </div>
    </div>
  )
}
