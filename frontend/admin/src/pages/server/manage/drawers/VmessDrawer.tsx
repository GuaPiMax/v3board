import { Input, Select } from 'antd'
import { stringifySettings } from '../utils'
import { json4, NetworkSettingsEditor } from './editors'
import { VmessTlsSettings } from './settings'
import {
  ChildDrawer,
  DrawerActions,
  EditConfigLabel,
  GroupField,
  NameRateRow,
  NodeDrawerFrame,
  ParentField,
  RouteField,
  TagsField,
  text,
  Trigger,
  useNodeDrawer,
  useSaveNode,
  withParsedSettings,
  type NodeDrawerProps,
} from './shared'

const NETWORK_PLACEHOLDERS = {
  tcp: json4({
    header: { type: 'http', request: { path: ['/'], headers: { Host: ['www.baidu.com', 'www.bing.com'] } }, response: {} },
  }),
  ws: json4({ path: '/', headers: { Host: 'v2ray.com' } }),
  grpc: json4({ serviceName: 'GunService' }),
  kcp: json4({ header: { type: 'none' }, seed: '' }),
  httpupgrade: json4({ path: '/', host: 'xtls.github.io' }),
  xhttp: json4({ path: '/', host: 'xtls.github.io' }),
}

export const V2RAY_NETWORKS = [
  { value: 'tcp', label: 'TCP' },
  { value: 'ws', label: 'WebSocket' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'kcp', label: 'mKCP' },
  { value: 'httpupgrade', label: 'HTTPUpgrade' },
  { value: 'xhttp', label: 'XHTTP' },
]

// VMess 节点（原版模块 3XVG）。字段为驼峰：networkSettings / tlsSettings / dnsSettings
export function VmessDrawer({ record, children }: NodeDrawerProps) {
  const { server, setServer, visible, setVisible, child, showChild, change } = useNodeDrawer(record, () => ({
    tls: 0,
    rate: 1,
  }))
  const { saving, save } = useSaveNode('vmess')
  const onShow = () => {
    setVisible((v) => !v)
    setServer((s) => stringifySettings(s, 'networkSettings'))
  }
  const submit = () => {
    let params = withParsedSettings(server, 'networkSettings')
    if (!params) return
    // 没有 DNS 服务器时提交 null（原版界面里没有编辑 DNS 的入口，这一项总是 null）
    if (!(params.dnsSettings as { servers?: unknown[] } | null)?.servers?.length) params = { ...params, dnsSettings: null }
    void save(params, onShow)
  }

  return (
    <>
      <Trigger onClick={onShow}>{children}</Trigger>
      <NodeDrawerFrame server={server} visible={visible} onClose={onShow}>
        <div>
          <NameRateRow server={server} change={change} />
          <TagsField server={server} change={change} />
          <GroupField server={server} change={change} />
          <div className="row">
            <div className="form-group col-md-8 col-xs-12">
              <label>节点地址</label>
              <Input placeholder="请输入连接地址" value={text(server.host)} onChange={(e) => change('host', e.target.value)} />
            </div>
            <div className="form-group col-md-4 col-xs-12">
              <EditConfigLabel label="TLS" onClick={() => showChild('编辑TLS配置', 'tlsSettings')} />
              <Select<number>
                value={Number.parseInt(String(server.tls), 10) ? 1 : 0}
                placeholder="是否支持TLS"
                style={{ width: '100%' }}
                onChange={(v) => change('tls', v)}
                options={[
                  { value: 0, label: '不支持' },
                  { value: 1, label: '支持' },
                ]}
              />
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-6 col-xs-12">
              <label>连接端口</label>
              <Input placeholder="用户连接端口" value={text(server.port)} onChange={(e) => change('port', e.target.value)} />
            </div>
            <div className="form-group col-md-6 col-xs-12">
              <label>服务端口</label>
              <Input
                placeholder="非NAT同连接端口"
                value={text(server.server_port)}
                onChange={(e) => change('server_port', e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-12 col-xs-12">
              <EditConfigLabel label="传输协议" onClick={() => showChild('编辑协议配置', 'networkSettings')} />
              <Select<string>
                value={text(server.network)}
                placeholder="选择传输协议"
                style={{ width: '100%' }}
                onChange={(v) => change('network', v)}
                options={V2RAY_NETWORKS}
              />
            </div>
          </div>
          <ParentField type="vmess" server={server} change={change} iconLink />
          <RouteField server={server} change={change} />
        </div>
        <DrawerActions saving={saving} onCancel={onShow} onSave={submit} />
        <ChildDrawer state={child} onClose={() => showChild()}>
          {child.type === 'networkSettings' && (
            <NetworkSettingsEditor
              placeholders={NETWORK_PLACEHOLDERS}
              network={server.network}
              value={server.networkSettings}
              onChange={(v) => change('networkSettings', v)}
            />
          )}
          {child.type === 'tlsSettings' && (
            <VmessTlsSettings settings={server.tlsSettings} onChange={(v) => change('tlsSettings', v)} />
          )}
        </ChildDrawer>
      </NodeDrawerFrame>
    </>
  )
}
