// 各协议节点编辑抽屉的公共部分。原版（模块 uzXD / H9LU / 3XVG / ykC2）每个协议各写一份几乎相同的代码：
// 名称与倍率、标签、权限组、父节点、路由组、底部按钮、嵌套的子抽屉，这里抽成组件，协议相关的字段仍在各自文件里按原版顺序书写。
import { QuestionCircleOutlined, ReadOutlined } from '@ant-design/icons'
import { Button, Drawer, Input, Select, Tooltip } from 'antd'
import { cloneElement, useState, type MouseEventHandler, type ReactElement, type ReactNode } from 'react'
import { CACHED_ONLY, queryKeys, useRefetch, useServerGroups, useServerNodes, useServerRoutes } from '@/api/queries'
import { saveNode } from '@/api/services/serverManage'
import type { NodeType, ServerNode } from '@/api/types'
import { notification } from '@/app/staticApi'
import { JsLink } from '@/components/JsLink'
import { GroupModal } from '@/pages/server/group/GroupModal'
import { parseSettings } from '../utils'

/** 表单里的节点：各协议字段不同，与原版一样整条记录原样提交 */
export type NodeForm = Record<string, unknown> & { id?: number }

export type Change = (key: string, value: unknown) => void

/** 表单字段取值（原版直接把 state 里的值交给输入框） */
export const text = (value: unknown) => value as string | undefined

export interface NodeDrawerProps {
  /** 编辑时的节点；新建时为空（使用各协议的默认值） */
  record?: ServerNode
  /** 点击后打开抽屉的元素（原版用 cloneElement 覆盖它的 onClick） */
  children: ReactElement<{ onClick?: MouseEventHandler }>
}

interface ChildDrawerState {
  visible: boolean
  title?: string
  type?: string
}

/**
 * 抽屉状态。与原版一致：表单内容只在组件创建时从 record（或默认值）初始化，关闭后再打开仍保留未保存的修改
 */
export function useNodeDrawer(record: ServerNode | undefined, defaults: () => NodeForm) {
  const [server, setServer] = useState<NodeForm>(() => record ?? defaults())
  const [visible, setVisible] = useState(false)
  const [child, setChild] = useState<ChildDrawerState>({ visible: false })
  const change: Change = (key, value) => setServer((s) => ({ ...s, [key]: value }))
  /** 原版 showChildDrawer：切换子抽屉；关闭时不传参数，标题与内容随之清空 */
  const showChild = (title?: string, type?: string) => setChild((c) => ({ ...c, visible: !c.visible, title, type }))
  return { server, setServer, visible, setVisible, child, showChild, change }
}

/**
 * 保存（原版 server<协议>/save）：成功后刷新节点列表（不等待），再执行 callback（关闭抽屉）
 */
export function useSaveNode(type: NodeType) {
  const [saving, setSaving] = useState(false)
  const refetchNodes = useRefetch(queryKeys.serverNodes)
  const save = async (params: object, callback: () => void) => {
    setSaving(true)
    const res = await saveNode(type, params)
    setSaving(false)
    if (res.code !== 200) return
    void refetchNodes()
    callback()
  }
  return { saving, save }
}

/**
 * 生成提交参数：把传输协议配置（JSON 文本）解析成对象，不改动表单本身（保存失败后可以直接改正再提交）。
 * JSON 有误时提示「传输协议配置格式有误」并返回 undefined。
 * 有意修正：原版 Trojan、V2node 在 JSON 有误时没有任何提示（Vmess、Vless 有），这里统一提示
 */
export function withParsedSettings(server: NodeForm, key: string): NodeForm | undefined {
  try {
    return parseSettings(server, key)
  } catch {
    notification.error({ title: '请求失败', description: '传输协议配置格式有误' })
    return undefined
  }
}

/** 打开抽屉的触发元素 */
export function Trigger({ children, onClick }: { children: NodeDrawerProps['children']; onClick: () => void }) {
  return cloneElement(children, { onClick })
}

interface FrameProps {
  server: NodeForm
  visible: boolean
  onClose: () => void
  children: ReactNode
}

/** 节点抽屉（原版 id="server"，宽 80%，最大 500px） */
export function NodeDrawerFrame({ server, visible, onClose, children }: FrameProps) {
  return (
    <Drawer id="server" maskClosable title={server.id ? '编辑节点' : '新建节点'} size="80%" open={visible} onClose={onClose}>
      {children}
    </Drawer>
  )
}

/** 嵌套的子抽屉（安全性 / 传输协议 / 加密 / 填充方案配置），没有关闭按钮，点遮罩关闭 */
export function ChildDrawer({ state, onClose, children }: { state: ChildDrawerState; onClose: () => void; children: ReactNode }) {
  return (
    <Drawer closable={false} id="server" size="80%" title={state.title} open={state.visible} onClose={onClose}>
      {children}
    </Drawer>
  )
}

export function NameRateRow({ server, change }: { server: NodeForm; change: Change }) {
  return (
    <div className="row">
      <div className="form-group col-8">
        <label>节点名称</label>
        <Input placeholder="请输入节点名称" value={text(server.name)} onChange={(e) => change('name', e.target.value)} />
      </div>
      <div className="form-group col-4">
        <label>倍率</label>
        <Input
          addonAfter="x"
          placeholder="请输入节点倍率"
          value={text(server.rate)}
          onChange={(e) => change('rate', e.target.value)}
        />
      </div>
    </div>
  )
}

/** 标签类输入（节点标签、信任的 XFF 头部）：清空时存为 null */
export function TagsSelect({
  value,
  placeholder,
  onChange,
}: {
  value: unknown
  placeholder: string
  onChange: (value: string[] | null) => void
}) {
  return (
    <Select<string[]>
      mode="tags"
      value={(value as string[] | null) || []}
      style={{ width: '100%' }}
      placeholder={placeholder}
      onChange={(v) => onChange(v.length > 0 ? v : null)}
    />
  )
}

export function TagsField({ server, change }: { server: NodeForm; change: Change }) {
  return (
    <div className="form-group">
      <label>节点标签</label>
      <TagsSelect value={server.tags} placeholder="输入后回车添加标签" onChange={(v) => change('tags', v)} />
    </div>
  )
}

/** 权限组（原版选项以 key 作为值，所以选中的是字符串 id） */
export function GroupField({ server, change }: { server: NodeForm; change: Change }) {
  const { data: groups = [] } = useServerGroups(CACHED_ONLY)
  return (
    <div className="form-group">
      <label>
        权限组{' '}
        <GroupModal>
          <JsLink>添加权限组</JsLink>
        </GroupModal>
      </label>
      <Select<string[]>
        mode="multiple"
        value={server.group_id as string[] | undefined}
        placeholder="请选择权限组"
        style={{ width: '100%' }}
        options={groups.map((group) => ({ value: String(group.id), label: group.name }))}
        onChange={(v) => change('group_id', v)}
      />
    </div>
  )
}

/** 「允许不安全」选择框的标签 */
export function InsecureLabel() {
  return (
    <label>
      <Tooltip placement="top" title="使用自签名证书需要允许不安全，用户才可以连接">
        允许不安全 <QuestionCircleOutlined />
      </Tooltip>
    </label>
  )
}

/** 否 / 是 选择框（值为 0 / 1） */
export function YesNoSelect({
  value,
  placeholder,
  onChange,
}: {
  value: unknown
  placeholder?: string
  onChange: (value: number) => void
}) {
  return (
    <Select<number>
      value={Number.parseInt(String(value), 10) ? 1 : 0}
      placeholder={placeholder}
      style={{ width: '100%' }}
      options={[
        { value: 0, label: '否' },
        { value: 1, label: '是' },
      ]}
      onChange={onChange}
    />
  )
}

/**
 * 父节点：同协议的其他节点。原版 Vmess / Vless 的说明链接是一个图标，其余协议是「更多解答」
 */
export function ParentField({
  type,
  server,
  change,
  iconLink = false,
}: {
  type: NodeType
  server: NodeForm
  change: Change
  iconLink?: boolean
}) {
  const { data: nodes = [] } = useServerNodes(CACHED_ONLY)
  return (
    <div className="form-group">
      <label>
        <Tooltip placement="top">
          父节点{' '}
          <a target="_blank" href="https://docs.v2board.com/use/node.html#父节点与子节点关系" rel="noreferrer">
            {iconLink ? <ReadOutlined /> : '更多解答'}
          </a>
        </Tooltip>
      </label>
      <Select<number | string>
        value={(server.parent_id as number | null) || ''}
        onChange={(v) => change('parent_id', v)}
        style={{ width: '100%' }}
        options={[
          { value: '', label: '无' },
          ...nodes
            .filter((node) => node.type === type && node.id !== server.id)
            .map((node) => ({ value: node.id, label: node.name })),
        ]}
      />
    </div>
  )
}

/** 路由组（选项以 key 作为值，选中的是字符串 id；清空时存为 null） */
export function RouteField({ server, change }: { server: NodeForm; change: Change }) {
  const { data: routes = [] } = useServerRoutes(CACHED_ONLY)
  return (
    <div className="form-group">
      <label>路由组</label>
      <Select<string[]>
        mode="multiple"
        value={(server.route_id as string[] | null) || []}
        placeholder="请选择路由组"
        style={{ width: '100%' }}
        options={routes.map((route) => ({ value: String(route.id), label: route.remarks }))}
        onChange={(v) => change('route_id', v.length > 0 ? v : null)}
      />
    </div>
  )
}

/** 底部「取消 / 提交」 */
export function DrawerActions({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="v2board-drawer-action">
      <Button style={{ marginRight: 8 }} onClick={onCancel}>
        取消
      </Button>
      <Button loading={saving} onClick={onSave} type="primary">
        提交
      </Button>
    </div>
  )
}

/** 带「编辑配置」链接的标签（安全性、传输协议、加密方式） */
export function EditConfigLabel({ label, show = true, onClick }: { label: string; show?: boolean; onClick: () => void }) {
  return (
    <label>
      {label} {show && <JsLink onClick={onClick}>编辑配置</JsLink>}
    </label>
  )
}
