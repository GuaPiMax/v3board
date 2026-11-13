import { Input, Select } from 'antd'
import { json4, NetworkSettingsEditor } from './editors'
import {
  ChildDrawer,
  DrawerActions,
  EditConfigLabel,
  GroupField,
  InsecureLabel,
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
  YesNoSelect,
  type NodeDrawerProps,
} from './shared'
import { stringifySettings } from '../utils'

const NETWORK_PLACEHOLDERS = {
  tcp: '',
  ws: json4({ path: '/', headers: { Host: 'v2ray.com' } }),
  grpc: json4({ serviceName: 'GunService' }),
}

// Trojan 节点（原版模块 ykC2）
export function TrojanDrawer({ record, children }: NodeDrawerProps) {
  const { server, setServer, visible, setVisible, child, showChild, change } = useNodeDrawer(record, () => ({
    tls: 0,
    rate: 1,
  }))
  const { saving, save } = useSaveNode('trojan')
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
            <div className="form-group col-md-12 col-xs-12">
              <label>节点地址</label>
              <Input placeholder="地址或IP" value={text(server.host)} onChange={(e) => change('host', e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-4 col-xs-12">
              <label>连接端口</label>
              <Input placeholder="用户连接端口" value={text(server.port)} onChange={(e) => change('port', e.target.value)} />
            </div>
            <div className="form-group col-md-4 col-xs-12">
              <label>服务端口</label>
              <Input
                placeholder="服务端开放端口"
                value={text(server.server_port)}
                onChange={(e) => change('server_port', e.target.value)}
              />
            </div>
            <div className="form-group col-md-4 col-xs-12">
              <InsecureLabel />
              <YesNoSelect
                value={server.allow_insecure}
                placeholder="允许不安全"
                onChange={(v) => change('allow_insecure', v)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>服务器名称指示(sni)</label>
            <Input
              placeholder="当节点地址与证书不一致时用于证书验证"
              value={text(server.server_name)}
              onChange={(e) => change('server_name', e.target.value)}
            />
          </div>
          <div className="row">
            <div className="form-group col-md-12 col-xs-12">
              <EditConfigLabel label="传输协议" onClick={() => showChild('编辑协议配置', 'network_settings')} />
              <Select<string>
                value={text(server.network)}
                placeholder="选择传输协议"
                style={{ width: '100%' }}
                onChange={(v) => change('network', v)}
                options={[
                  { value: 'tcp', label: 'TCP' },
                  { value: 'ws', label: 'WebSocket' },
                  { value: 'grpc', label: 'gRPC' },
                ]}
              />
            </div>
          </div>
          <ParentField type="trojan" server={server} change={change} />
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
        </ChildDrawer>
      </NodeDrawerFrame>
    </>
  )
}
