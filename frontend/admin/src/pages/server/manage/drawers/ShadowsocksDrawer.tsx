import { Input, Select } from 'antd'
import {
  DrawerActions,
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
  type NodeDrawerProps,
} from './shared'

export const SS_CIPHERS = [
  'aes-128-gcm',
  'aes-192-gcm',
  'aes-256-gcm',
  'chacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm',
  '2022-blake3-aes-256-gcm',
].map((value) => ({ value, label: value }))

// Shadowsocks 节点（原版模块 H9LU）
export function ShadowsocksDrawer({ record, children }: NodeDrawerProps) {
  const { server, setServer, visible, setVisible, change } = useNodeDrawer(record, () => ({
    cipher: 'chacha20-ietf-poly1305',
    rate: 1,
  }))
  const { saving, save } = useSaveNode('shadowsocks')
  const onShow = () => setVisible((v) => !v)
  const obfs = server.obfs_settings as { path?: string; host?: string } | null | undefined
  const setObfsSettings = (key: string, value: string) =>
    setServer((s) => ({ ...s, obfs_settings: { ...(s.obfs_settings as object | null), [key]: value } }))

  return (
    <>
      <Trigger onClick={() => setVisible(true)}>{children}</Trigger>
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
            <div className="form-group col-md-6 col-xs-12">
              <label>连接端口</label>
              <Input placeholder="用户连接端口" value={text(server.port)} onChange={(e) => change('port', e.target.value)} />
            </div>
            <div className="form-group col-md-6 col-xs-12">
              <label>服务端口</label>
              <Input
                placeholder="服务端开放端口"
                value={text(server.server_port)}
                onChange={(e) => change('server_port', e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>加密算法</label>
            <Select<string>
              value={text(server.cipher)}
              onChange={(v) => change('cipher', v)}
              style={{ width: '100%' }}
              options={SS_CIPHERS}
            />
          </div>
          <div className="form-group">
            <label>混淆</label>
            <Select<string>
              value={text(server.obfs) || ''}
              onChange={(v) => change('obfs', v)}
              style={{ width: '100%' }}
              options={[
                { value: '', label: '无' },
                { value: 'http', label: 'HTTP' },
              ]}
            />
            <div>
              {server.obfs === 'http' && (
                <div className="row mt-2">
                  <div className="form-group col-4 mb-0">
                    <Input placeholder="路径" value={obfs?.path} onChange={(e) => setObfsSettings('path', e.target.value)} />
                  </div>
                  <div className="form-group col-8 mb-0">
                    <Input placeholder="Host" value={obfs?.host} onChange={(e) => setObfsSettings('host', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <ParentField type="shadowsocks" server={server} change={change} />
          <RouteField server={server} change={change} />
        </div>
        <DrawerActions saving={saving} onCancel={onShow} onSave={() => void save(server, onShow)} />
      </NodeDrawerFrame>
    </>
  )
}
