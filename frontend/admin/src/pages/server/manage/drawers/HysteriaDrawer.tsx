import { Input, Select } from 'antd'
import {
  DrawerActions,
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
  YesNoSelect,
  type NodeDrawerProps,
} from './shared'

// Hysteria 节点（原版模块 uzXD 的 V）：v1 混淆为 xplus，v2 为 salamander
export function HysteriaDrawer({ record, children }: NodeDrawerProps) {
  const { server, visible, setVisible, change } = useNodeDrawer(record, () => ({ insecure: 0, version: 1, rate: 1 }))
  const { saving, save } = useSaveNode('hysteria')
  const onShow = () => setVisible((v) => !v)
  const version = Number.parseInt(String(server.version), 10)

  return (
    <>
      <Trigger onClick={() => setVisible(true)}>{children}</Trigger>
      <NodeDrawerFrame server={server} visible={visible} onClose={onShow}>
        <div>
          <NameRateRow server={server} change={change} />
          <TagsField server={server} change={change} />
          <GroupField server={server} change={change} />
          <div className="row">
            <div className="form-group col-md-3 col-xs-12">
              <label>HYSTERIA版本</label>
              <Select<number>
                value={version ? version : 1}
                style={{ width: '100%' }}
                onChange={(v) => change('version', v)}
                options={[
                  { value: 1, label: 'v1' },
                  { value: 2, label: 'v2' },
                ]}
              />
            </div>
          </div>
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
              <YesNoSelect value={server.insecure} placeholder="允许不安全" onChange={(v) => change('insecure', v)} />
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
            {version === 1 && (
              <div className="form-group col-md-6 col-xs-12">
                <label>混淆方式obfs</label>
                <Select<string | null>
                  value={server.obfs as string | null | undefined}
                  style={{ width: '100%' }}
                  onChange={(v) => change('obfs', v)}
                  options={[
                    { value: null, label: '无' },
                    { value: 'xplus', label: 'xplus' },
                  ]}
                />
              </div>
            )}
            {version === 1 && server.obfs === 'xplus' && (
              <div className="form-group col-md-6 col-xs-12">
                <label>混淆密码obfsParam</label>
                <Input
                  value={text(server.obfs_password)}
                  placeholder="留空自动生成"
                  onChange={(e) => change('obfs_password', e.target.value)}
                />
              </div>
            )}
            {version === 2 && (
              <div className="form-group col-md-6 col-xs-12">
                <label>混淆方式obfs</label>
                <Select<string | null>
                  value={server.obfs as string | null | undefined}
                  style={{ width: '100%' }}
                  onChange={(v) => change('obfs', v)}
                  options={[
                    { value: null, label: '无' },
                    { value: 'salamander', label: 'salamander' },
                  ]}
                />
              </div>
            )}
            {version === 2 && server.obfs === 'salamander' && (
              <div className="form-group col-md-6 col-xs-12">
                <label>混淆密码obfs_password</label>
                <Input
                  value={text(server.obfs_password)}
                  placeholder="留空自动生成"
                  onChange={(e) => change('obfs_password', e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>上行带宽</label>
            <Input
              addonAfter="Mbps"
              placeholder="服务端发送带宽,留空或填0使用BBR"
              value={text(server.up_mbps)}
              onChange={(e) => change('up_mbps', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>下行带宽</label>
            <Input
              addonAfter="Mbps"
              placeholder="服务端接收带宽,留空或填0使用BBR"
              value={text(server.down_mbps)}
              onChange={(e) => change('down_mbps', e.target.value)}
            />
          </div>
          <ParentField type="hysteria" server={server} change={change} />
          <RouteField server={server} change={change} />
        </div>
        <DrawerActions saving={saving} onCancel={onShow} onSave={() => void save(server, onShow)} />
      </NodeDrawerFrame>
    </>
  )
}
