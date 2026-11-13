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
  type Change,
  type NodeForm,
} from './shared'
import type { NodeDrawerProps } from './shared'

export const UDP_RELAY_MODES = ['native', 'quic'].map((value) => ({ value, label: value }))
export const CONGESTION_CONTROLS = ['cubic', 'new_reno', 'bbr'].map((value) => ({ value, label: value }))

/** 禁用 SNI + 数据包中继模式（Tuic、V2node 的 tuic 协议共用） */
export function TuicSniRelayRow({ server, change }: { server: NodeForm; change: Change }) {
  return (
    <div className="row">
      <div className="form-group col-md-6 col-xs-12">
        <label>禁用SNI</label>
        <YesNoSelect value={server.disable_sni} onChange={(v) => change('disable_sni', v)} />
      </div>
      <div className="form-group col-md-6 col-xs-12">
        <label>数据包中继模式</label>
        <Select<string>
          value={text(server.udp_relay_mode) ? text(server.udp_relay_mode) : 'native'}
          style={{ width: '100%' }}
          onChange={(v) => change('udp_relay_mode', v)}
          options={UDP_RELAY_MODES}
        />
      </div>
    </div>
  )
}

/** 拥塞控制算法 + 0-RTT（Tuic、V2node 的 tuic 协议共用） */
export function TuicCongestionRow({ server, change }: { server: NodeForm; change: Change }) {
  return (
    <div className="row">
      <div className="form-group col-md-6 col-xs-12">
        <label>拥塞控制算法</label>
        <Select<string>
          value={text(server.congestion_control) ? text(server.congestion_control) : 'cubic'}
          style={{ width: '100%' }}
          onChange={(v) => change('congestion_control', v)}
          options={CONGESTION_CONTROLS}
        />
      </div>
      <div className="form-group col-md-6 col-xs-12">
        <label>客户端启用 0-RTT</label>
        <YesNoSelect value={server.zero_rtt_handshake} onChange={(v) => change('zero_rtt_handshake', v)} />
      </div>
    </div>
  )
}

// Tuic 节点（原版模块 uzXD 的 wTuic）
export function TuicDrawer({ record, children }: NodeDrawerProps) {
  const { server, visible, setVisible, change } = useNodeDrawer(record, () => ({
    insecure: 0,
    disable_sni: 0,
    udp_relay_mode: 'native',
    zero_rtt_handshake: 0,
    congestion_control: 'cubic',
    rate: 1,
  }))
  const { saving, save } = useSaveNode('tuic')
  const onShow = () => setVisible((v) => !v)

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
          <TuicSniRelayRow server={server} change={change} />
          {!Number.parseInt(String(server.disable_sni), 10) && (
            <div className="form-group">
              <label>服务器名称指示(sni)</label>
              <Input
                placeholder="当节点地址与证书不一致时用于证书验证"
                value={text(server.server_name)}
                onChange={(e) => change('server_name', e.target.value)}
              />
            </div>
          )}
          <TuicCongestionRow server={server} change={change} />
          <ParentField type="tuic" server={server} change={change} />
          <RouteField server={server} change={change} />
        </div>
        <DrawerActions saving={saving} onCancel={onShow} onSave={() => void save(server, onShow)} />
      </NodeDrawerFrame>
    </>
  )
}
