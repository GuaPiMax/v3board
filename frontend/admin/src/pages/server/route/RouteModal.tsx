import { LoadingOutlined } from '@ant-design/icons'
import { useIsFetching } from '@tanstack/react-query'
import { Button, Input, Modal, Select } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement } from 'react'
import { queryKeys, useRefetch } from '@/api/queries'
import { saveServerRoute } from '@/api/services/serverRoute'
import type { ServerRoute } from '@/api/types'
import { FormGroup } from '@/components/FormGroup'
import { ROUTE_ACTION_TEXT, type RouteAction } from '@/utils/constants'

interface RouteModalProps {
  route?: ServerRoute
  /** 点击后打开弹窗的元素（原版用 cloneElement 覆盖它的 onClick） */
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

type RouteForm = Partial<Omit<ServerRoute, 'match'>> & { match?: string[] | string | null }

const ACTION_OPTIONS = (Object.keys(ROUTE_ACTION_TEXT) as RouteAction[]).map((value) => ({
  value,
  label: ROUTE_ACTION_TEXT[value],
}))

const OUTBOUND_PLACEHOLDER = JSON.stringify(
  {
    tag: 'ss_out',
    sendThrough: '0.0.0.0',
    protocol: 'shadowsocks',
    settings: {
      email: 'love@xray.com',
      address: '8.8.8.8',
      port: 5555,
      method: 'chacha20-ietf-poly1305',
      password: 'abcdefghijklmnopqrstuvwxyz',
      level: 0,
    },
  },
  null,
  4,
)

function matchPlaceholder(action?: RouteAction) {
  if (action === 'protocol') return 'http\ntls\nquic\nbittorrent'
  if (action === 'block_port') return '53\n443\n1000-2000'
  if (action === 'route_ip' || action === 'block_ip') {
    return '127.0.0.1(单一匹配)\n10.0.0.0/8(范围匹配)\ngeoip:cn(预定义列表匹配)'
  }
  return 'example.com(关键字匹配)\ndomain:example.com(子域名匹配)\ngeosite:netflix(预定义域名列表)'
}

/** 匹配值文本框：数组按行显示，旧版逗号分隔的字符串也拆成多行 */
function matchText(match: RouteForm['match']) {
  if (typeof match === 'object') return match?.join('\n')
  return match?.split(',').join('\n')
}

// 原版「填写参考」链接里有一个空的 link 按钮（占位 32px 高），保留以还原标签行的高度
function ReferenceLink({ href }: { href: string }) {
  return (
    <a href={href}>
      <Button type="link" />
      填写参考
    </a>
  )
}

// 创建 / 编辑路由弹窗（原版模块 wtkT 里的路由弹窗）。
// 与原版一致：表单内容只在组件创建时从 route 初始化，关闭或保存后不会重置。
export function RouteModal({ route: record, children }: RouteModalProps) {
  const [visible, setVisible] = useState(false)
  const [route, setRoute] = useState<RouteForm>(() => record ?? {})
  const loading = useIsFetching({ queryKey: queryKeys.serverRoutes }) > 0
  const refetch = useRefetch(queryKeys.serverRoutes)

  const save = async () => {
    const params = { ...route }
    if (Array.isArray(params.match)) params.match = params.match.filter(Boolean)
    else if (params.match && typeof params.match === 'string') params.match = params.match.split(',').filter(Boolean)
    else params.match = []
    const res = await saveServerRoute(params as Partial<ServerRoute>)
    if (res.code !== 200) return
    void refetch()
    setVisible(false)
  }

  const { action } = route
  return (
    <>
      {cloneElement(children, { onClick: () => setVisible(true) })}
      <Modal
        title={route.id ? '编辑路由' : '创建路由'}
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={() => loading || void save()}
        okText={loading ? <LoadingOutlined /> : '提交'}
        cancelText="取消"
      >
        <div>
          <FormGroup label="备注">
            <Input
              placeholder="请输入备注"
              value={route.remarks}
              onChange={(e) => setRoute({ ...route, remarks: e.target.value })}
            />
          </FormGroup>
          {action !== 'default_out' && (
            <FormGroup
              label={
                <>
                  匹配值
                  <ReferenceLink href="https://xtls.github.io/config/routing.html#ruleobject" />
                </>
              }
            >
              <Input.TextArea
                rows={5}
                placeholder={matchPlaceholder(action)}
                value={matchText(route.match)}
                onChange={(e) => setRoute({ ...route, match: e.target.value.split('\n') })}
              />
            </FormGroup>
          )}
          <FormGroup label="动作">
            <div>
              <Select<RouteAction>
                value={action}
                placeholder="请选择动作"
                style={{ width: '100%' }}
                options={ACTION_OPTIONS}
                onChange={(value) => setRoute({ ...route, action: value })}
              />
            </div>
          </FormGroup>
          {action === 'dns' && (
            <FormGroup label="DNS服务器">
              <Input
                placeholder="请输入用于解析的DNS服务器地址"
                value={route.action_value ?? undefined}
                onChange={(e) => setRoute({ ...route, action_value: e.target.value })}
              />
            </FormGroup>
          )}
          {(action === 'route' || action === 'route_ip' || action === 'default_out') && (
            <FormGroup
              label={
                <>
                  Xray出站配置
                  <ReferenceLink href="https://xtls.github.io/config/outbound.html" />
                </>
              }
            >
              <Input.TextArea
                rows={8}
                placeholder={OUTBOUND_PLACEHOLDER}
                value={route.action_value ?? undefined}
                onChange={(e) => setRoute({ ...route, action_value: e.target.value })}
              />
            </FormGroup>
          )}
        </div>
      </Modal>
    </>
  )
}
