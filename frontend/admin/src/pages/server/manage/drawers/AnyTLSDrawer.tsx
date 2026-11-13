import { Input } from 'antd'
import { JsLink } from '@/components/JsLink'
import { PaddingSchemeEditor } from './editors'
import {
  ChildDrawer,
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

// AnyTLS 节点（原版模块 uzXD 的 wAnyTLS）。填充方案以 JSON 文本提交（列表接口返回的也是 JSON 文本）
export function AnyTLSDrawer({ record, children }: NodeDrawerProps) {
  const { server, visible, setVisible, child, showChild, change } = useNodeDrawer(record, () => ({ insecure: 0, rate: 1 }))
  const { saving, save } = useSaveNode('anytls')
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
              <label>
                <JsLink onClick={() => showChild('编辑填充方案', 'padding_scheme')}>编辑填充方案</JsLink>
              </label>
            </div>
          </div>
          <ParentField type="anytls" server={server} change={change} />
          <RouteField server={server} change={change} />
        </div>
        <DrawerActions saving={saving} onCancel={onShow} onSave={() => void save(server, onShow)} />
        {/* 与原版一致：子抽屉只有填充方案一种内容，关闭后编辑器仍保留 */}
        <ChildDrawer state={child} onClose={() => showChild()}>
          <PaddingSchemeEditor value={server.padding_scheme} onChange={(v) => change('padding_scheme', v)} />
        </ChildDrawer>
      </NodeDrawerFrame>
    </>
  )
}
