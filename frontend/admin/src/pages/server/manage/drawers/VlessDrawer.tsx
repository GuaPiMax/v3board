import { Input, Select } from 'antd'
import { json4, NetworkSettingsEditor } from './editors'
import { EncryptionSettings, TlsSettings } from './settings'
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
import { stringifySettings } from '../utils'
import { V2RAY_NETWORKS } from './VmessDrawer'

const NETWORK_PLACEHOLDERS = {
  tcp: json4({
    header: { type: 'http', request: { path: ['/'], headers: { Host: ['www.baidu.com', 'www.bing.com'] } }, response: {} },
  }),
  ws: json4({ security: 'auto', path: '/', headers: { Host: 'xtls.github.io' } }),
  grpc: json4({ serviceName: 'GunService' }),
  kcp: json4({ header: { type: 'none' }, seed: '' }),
  httpupgrade: json4({ path: '/', host: 'xtls.github.io' }),
  xhttp: json4({ path: '/', host: 'xtls.github.io', mode: 'auto', extra: {} }),
}

export const ENCRYPTIONS = [
  { value: null, label: '无' },
  { value: 'mlkem768x25519plus', label: 'MLKEM768X25519PLUS' },
]

// VLESS 节点（原版模块 uzXD 的 z）
export function VlessDrawer({ record, children }: NodeDrawerProps) {
  const { server, setServer, visible, setVisible, child, showChild, change } = useNodeDrawer(record, () => ({
    tls: 0,
    rate: 1,
    flow: null,
  }))
  const { saving, save } = useSaveNode('vless')
  const onShow = () => {
    setVisible((v) => !v)
    setServer((s) => stringifySettings(s, 'network_settings'))
  }
  const submit = () => {
    const params = withParsedSettings(server, 'network_settings')
    if (params) void save(params, onShow)
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
              <EditConfigLabel
                label="安全性"
                show={Number.parseInt(String(server.tls), 10) !== 0}
                onClick={() => showChild('编辑安全性配置', 'tls_settings')}
              />
              <Select<number>
                value={Number.parseInt(String(server.tls), 10) || 0}
                style={{ width: '100%' }}
                onChange={(v) => change('tls', v)}
                options={[
                  { value: 0, label: '无' },
                  { value: 1, label: 'TLS' },
                  { value: 2, label: 'Reality' },
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
              <EditConfigLabel label="传输协议" onClick={() => showChild('编辑协议配置', 'network_settings')} />
              <Select<string>
                value={text(server.network)}
                placeholder="选择传输协议"
                style={{ width: '100%' }}
                onChange={(v) => change('network', v)}
                options={V2RAY_NETWORKS}
              />
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-12 col-xs-12">
              <EditConfigLabel
                label="加密方式"
                show={Boolean(server.encryption)}
                onClick={() => showChild('编辑加密配置', 'encryption_settings')}
              />
              <Select<string | null>
                value={server.encryption as string | null | undefined}
                placeholder="选择加密方式"
                style={{ width: '100%' }}
                onChange={(v) => change('encryption', v)}
                options={ENCRYPTIONS}
              />
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-12 col-xs-12">
              <label>XTLS流控算法</label>
              <Select<string | null>
                value={server.flow as string | null | undefined}
                placeholder="选择XTLS流控算法"
                style={{ width: '100%' }}
                onChange={(v) => change('flow', v)}
                options={[
                  { value: null, label: '无' },
                  ...(server.network == 'tcp' ? [{ value: 'xtls-rprx-vision', label: 'xtls-rprx-vision' }] : []),
                ]}
              />
            </div>
          </div>
          <ParentField type="vless" server={server} change={change} iconLink />
          <RouteField server={server} change={change} />
        </div>
        <DrawerActions saving={saving} onCancel={onShow} onSave={submit} />
        <ChildDrawer state={child} onClose={() => showChild()}>
          {child.type === 'network_settings' && (
            <NetworkSettingsEditor
              placeholders={NETWORK_PLACEHOLDERS}
              network={server.network}
              value={server.network_settings}
              onChange={(v) => change('network_settings', v)}
            />
          )}
          {child.type === 'tls_settings' && (
            <TlsSettings settings={server.tls_settings} tls={server.tls} onChange={(v) => change('tls_settings', v)} />
          )}
          {child.type === 'encryption_settings' && (
            <EncryptionSettings settings={server.encryption_settings} onChange={(v) => change('encryption_settings', v)} />
          )}
        </ChildDrawer>
      </NodeDrawerFrame>
    </>
  )
}
