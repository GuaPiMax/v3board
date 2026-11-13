import { Input, Select } from 'antd'
import { JsLink } from '@/components/JsLink'
import { json4, NetworkSettingsEditor, PaddingSchemeEditor } from './editors'
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
  TagsSelect,
  text,
  Trigger,
  useNodeDrawer,
  useSaveNode,
  withParsedSettings,
  type Change,
  type NodeDrawerProps,
  type NodeForm,
} from './shared'
import { SS_CIPHERS } from './ShadowsocksDrawer'
import { TuicCongestionRow, TuicSniRelayRow } from './TuicDrawer'
import { ENCRYPTIONS } from './VlessDrawer'
import { stringifySettings } from '../utils'

const NETWORK_PLACEHOLDERS = {
  tcp: json4({
    acceptProxyProtocol: false,
    header: { type: 'http', request: { path: ['/'], headers: { Host: ['www.baidu.com', 'www.bing.com'] } }, response: {} },
  }),
  http: json4({ acceptProxyProtocol: false, path: '/', Host: 'xtls.github.io' }),
  ws: json4({ acceptProxyProtocol: false, path: '/', headers: { Host: 'xtls.github.io' } }),
  grpc: json4({ serviceName: 'GunService' }),
  httpupgrade: json4({ acceptProxyProtocol: false, path: '/', host: 'xtls.github.io' }),
  xhttp: json4({ path: '/', host: 'xtls.github.io', mode: 'auto', extra: {} }),
}

export const PROTOCOLS = [
  { value: 'anytls', label: 'AnyTLS' },
  { value: 'hysteria2', label: 'Hysteria2' },
  { value: 'shadowsocks', label: 'Shadowsocks' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'tuic', label: 'Tuic' },
  { value: 'vless', label: 'VLess' },
  { value: 'vmess', label: 'VMess' },
]
/** 这些协议必须使用 TLS：切换到它们时安全性自动设为 TLS */
const TLS_REQUIRED = ['anytls', 'hysteria2', 'trojan', 'tuic']
/** 安全性默认显示为 TLS 的协议 */
const TLS_DEFAULT = ['hysteria2', 'trojan', 'tuic']

function NetworkRow({ server, change, onEdit }: { server: NodeForm; change: Change; onEdit: () => void }) {
  const isShadowsocks = server.protocol == 'shadowsocks'
  return (
    <div className="row">
      <div className="form-group col-md-12 col-xs-12">
        <EditConfigLabel label="传输协议" onClick={onEdit} />
        <Select<string>
          value={(server.network as string | null | undefined) ?? 'tcp'}
          placeholder="选择传输协议"
          style={{ width: '100%' }}
          onChange={(v) => change('network', v)}
          options={
            isShadowsocks
              ? [
                  { value: 'tcp', label: 'TCP' },
                  { value: 'http', label: 'HTTP伪装' },
                ]
              : [
                  { value: 'tcp', label: 'TCP' },
                  { value: 'ws', label: 'WebSocket' },
                  { value: 'grpc', label: 'gRPC' },
                  ...(server.protocol != 'trojan'
                    ? [
                        { value: 'httpupgrade', label: 'HTTPUpgrade' },
                        { value: 'xhttp', label: 'XHTTP' },
                      ]
                    : []),
                ]
          }
        />
      </div>
    </div>
  )
}

// V2node 节点（原版模块 uzXD 的 wV2node）：一个节点可选多种协议，字段按协议显示
export function V2nodeDrawer({ record, children }: NodeDrawerProps) {
  const { server, setServer, visible, setVisible, child, showChild, change } = useNodeDrawer(record, () => ({
    tls: 0,
    rate: 1,
    network: 'tcp',
    disable_sni: 0,
    zero_rtt_handshake: 0,
    flow: null,
  }))
  const { saving, save } = useSaveNode('v2node')
  // 与原版一致：打开时不转换传输协议配置（子抽屉里显示时再转成文本），关闭时才转换
  const onShow = () => {
    setVisible((v) => !v)
    setServer((s) => stringifySettings(s, 'network_settings'))
  }
  const formChange: Change = (key, value) => {
    if (key === 'protocol' && TLS_REQUIRED.includes(value as string)) {
      setServer((s) => ({ ...s, protocol: value, tls: 1 }))
    } else {
      change(key, value)
    }
  }
  // 与原版一致：提交深拷贝后的数据（去掉一键安装指令）
  const submit = () => {
    const params = withParsedSettings(JSON.parse(JSON.stringify(server)) as NodeForm, 'network_settings')
    if (!params) return
    delete params.install_command
    void save(params, onShow)
  }

  const protocol = server.protocol as string | null | undefined
  const tls = Number.parseInt(String(server.tls), 10)
  const networkSettings = server.network_settings
  const networkText =
    networkSettings != null && typeof networkSettings === 'object' ? JSON.stringify(networkSettings, null, 2) : networkSettings

  return (
    <>
      <Trigger onClick={() => setVisible(true)}>{children}</Trigger>
      <NodeDrawerFrame server={server} visible={visible} onClose={onShow}>
        <div>
          <NameRateRow server={server} change={formChange} />
          <TagsField server={server} change={formChange} />
          <GroupField server={server} change={formChange} />
          <div className="row">
            <div className="form-group col-md-6 col-xs-12">
              <label>连接地址</label>
              <Input placeholder="地址或IP" value={text(server.host)} onChange={(e) => formChange('host', e.target.value)} />
            </div>
            <div className="form-group col-md-6 col-xs-12">
              <label>监听地址</label>
              <Input
                placeholder="地址或IP默认为0.0.0.0"
                value={text(server.listen_ip)}
                onChange={(e) => formChange('listen_ip', e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-6 col-xs-12">
              <label>连接端口</label>
              <Input placeholder="用户连接端口" value={text(server.port)} onChange={(e) => formChange('port', e.target.value)} />
            </div>
            <div className="form-group col-md-6 col-xs-12">
              <label>服务端口</label>
              <Input
                placeholder="服务端开放端口"
                value={text(server.server_port)}
                onChange={(e) => formChange('server_port', e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <div className="form-group col-md-6 col-xs-12">
              <label>节点协议</label>
              <Select<string>
                value={protocol ?? undefined}
                style={{ width: '100%' }}
                onChange={(v) => formChange('protocol', v)}
                options={PROTOCOLS}
              />
            </div>
            {protocol != null && protocol != 'shadowsocks' && (
              <div className="form-group col-md-6 col-xs-12">
                <EditConfigLabel
                  label="安全性"
                  show={tls !== 0 || TLS_DEFAULT.includes(protocol)}
                  onClick={() => showChild('编辑安全性配置', 'tls_settings')}
                />
                <Select<number>
                  value={tls || (TLS_DEFAULT.includes(protocol) ? 1 : 0)}
                  style={{ width: '100%' }}
                  onChange={(v) => formChange('tls', v)}
                  options={[
                    ...(protocol == 'vless' || protocol == 'vmess' ? [{ value: 0, label: '无' }] : []),
                    { value: 1, label: 'TLS' },
                    ...(protocol == 'vless' || protocol == 'anytls' ? [{ value: 2, label: 'Reality' }] : []),
                  ]}
                />
              </div>
            )}
          </div>
          {protocol == 'shadowsocks' && (
            <NetworkRow server={server} change={formChange} onEdit={() => showChild('编辑协议配置', 'network_settings')} />
          )}
          {protocol != null && protocol != 'hysteria2' && protocol != 'shadowsocks' && protocol != 'tuic' && (
            <NetworkRow server={server} change={formChange} onEdit={() => showChild('编辑协议配置', 'network_settings')} />
          )}
          {server.network != null &&
            (server.network == 'xhttp' || server.network == 'ws' || server.network == 'grpc') && (
              <div className="form-group">
                <label>信任的XFF头部(获取真实IP)</label>
                <TagsSelect
                  value={server.trusted_x_forwarded_for}
                  placeholder="常见头部:X-Forwarded-For CF-Connecting-IP X-Real-IP"
                  onChange={(v) => formChange('trusted_x_forwarded_for', v)}
                />
              </div>
            )}
          {protocol == 'anytls' && (
            <div className="row">
              <div className="form-group col-md-12 col-xs-12">
                <label>
                  <JsLink onClick={() => showChild('编辑填充方案', 'padding_scheme')}>编辑填充方案</JsLink>
                </label>
              </div>
            </div>
          )}
          {protocol == 'hysteria2' && (
            <div className="row">
              <div className="form-group col-md-6 col-xs-12">
                <label>混淆方式obfs</label>
                <Select<string | null>
                  value={server.obfs as string | null | undefined}
                  style={{ width: '100%' }}
                  onChange={(v) => formChange('obfs', v)}
                  options={[
                    { value: null, label: '无' },
                    { value: 'salamander', label: 'salamander' },
                  ]}
                />
              </div>
              {server.obfs === 'salamander' && (
                <div className="form-group col-md-6 col-xs-12">
                  <label>混淆密码obfs_password</label>
                  <Input
                    value={text(server.obfs_password)}
                    placeholder="留空自动生成"
                    onChange={(e) => formChange('obfs_password', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          {protocol == 'hysteria2' && (
            <div className="form-group">
              <label>上行带宽</label>
              <Input
                addonAfter="Mbps"
                placeholder="服务端发送带宽,留空或填0使用BBR"
                value={text(server.up_mbps)}
                onChange={(e) => formChange('up_mbps', e.target.value)}
              />
            </div>
          )}
          {protocol == 'hysteria2' && (
            <div className="form-group">
              <label>下行带宽</label>
              <Input
                addonAfter="Mbps"
                placeholder="服务端接收带宽,留空或填0使用BBR"
                value={text(server.down_mbps)}
                onChange={(e) => formChange('down_mbps', e.target.value)}
              />
            </div>
          )}
          {protocol == 'tuic' && <TuicSniRelayRow server={server} change={formChange} />}
          {protocol == 'tuic' && <TuicCongestionRow server={server} change={formChange} />}
          {protocol == 'shadowsocks' && (
            <div className="form-group">
              <label>加密算法</label>
              <Select<string>
                value={(server.cipher as string | null | undefined) ?? 'aes-128-gcm'}
                onChange={(v) => formChange('cipher', v)}
                style={{ width: '100%' }}
                options={SS_CIPHERS}
              />
            </div>
          )}
          {protocol == 'vless' && (
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
                  onChange={(v) => formChange('encryption', v)}
                  options={ENCRYPTIONS}
                />
              </div>
            </div>
          )}
          {protocol == 'vless' && (
            <div className="row">
              <div className="form-group col-md-12 col-xs-12">
                <label>XTLS流控算法</label>
                <Select<string | null>
                  value={server.flow as string | null | undefined}
                  placeholder="选择XTLS流控算法"
                  style={{ width: '100%' }}
                  onChange={(v) => formChange('flow', v)}
                  options={[
                    { value: null, label: '无' },
                    { value: 'xtls-rprx-vision', label: 'xtls-rprx-vision' },
                  ]}
                />
              </div>
            </div>
          )}
          <ParentField type="v2node" server={server} change={formChange} />
          <RouteField server={server} change={formChange} />
          <div className="form-group">
            <label>一键安装指令</label>
            <Input.TextArea
              value={text(server.install_command)}
              rows={4}
              readOnly
              // 皮肤里取 --v2b-readonly-bg（见 styles/skins/_shell.scss），legacy 下为原值
              style={{ backgroundColor: 'var(--v2b-readonly-bg, #f5f5f5a0)', cursor: 'text' }}
            />
          </div>
        </div>
        <DrawerActions saving={saving} onCancel={onShow} onSave={submit} />
        <ChildDrawer state={child} onClose={() => showChild()}>
          {child.type === 'network_settings' && (
            <NetworkSettingsEditor
              placeholders={NETWORK_PLACEHOLDERS}
              network={server.network}
              value={networkText}
              onChange={(v) => formChange('network_settings', v)}
            />
          )}
          {child.type === 'tls_settings' && (
            <TlsSettings
              settings={server.tls_settings}
              tls={server.tls}
              certApply
              onChange={(v) => setServer((s) => ({ ...s, tls_settings: v }))}
            />
          )}
          {child.type === 'encryption_settings' && (
            <EncryptionSettings
              settings={server.encryption_settings}
              onChange={(v) => setServer((s) => ({ ...s, encryption_settings: v }))}
            />
          )}
          {child.type === 'padding_scheme' && (
            <PaddingSchemeEditor value={server.padding_scheme} onChange={(v) => formChange('padding_scheme', v)} />
          )}
        </ChildDrawer>
      </NodeDrawerFrame>
    </>
  )
}
