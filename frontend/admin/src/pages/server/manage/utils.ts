// 节点管理的纯函数（不依赖浏览器环境，便于单元测试）
import type { NodeType, ServerNode } from '@/api/types'

type NodeForm = Record<string, unknown>

export type NodeSortPayload = Partial<Record<NodeType, Record<number, number>>>

type NodeKey = Pick<ServerNode, 'id' | 'type'>

/**
 * 排序模式下拖动一行：fromIndex / toIndex 是显示列表（可能经过搜索过滤）里的行号，在完整列表上移动对应的节点
 * （移到目标节点的位置）。有意修正：原版直接把显示列表的行号用在完整列表上，搜索后拖动会移动错节点
 */
export function moveNode<T extends NodeKey>(list: T[], displayed: T[], fromIndex: number, toIndex: number): T[] {
  const indexOf = (node: T | undefined) =>
    node ? list.findIndex((item) => item.type === node.type && item.id === node.id) : -1
  const from = indexOf(displayed[fromIndex])
  const to = indexOf(displayed[toIndex])
  if (from < 0 || to < 0 || from === to) return list
  const next = list.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** 排序请求体：{ 协议: { 节点 id: 在完整列表里的位置 } }（与原版 serverManage/saveSort 相同） */
export function toSortPayload(nodes: NodeKey[]): NodeSortPayload {
  const payload: NodeSortPayload = {}
  nodes.forEach((node, index) => {
    ;(payload[node.type] ??= {})[node.id] = index
  })
  return payload
}

/** 打开 / 关闭抽屉时把对象形式的传输协议配置转成 JSON 文本（原版 onShow），编辑器里显示的就是它 */
export function stringifySettings<T extends NodeForm>(server: T, key: string): T {
  const value = server[key]
  return value && typeof value === 'object' ? { ...server, [key]: JSON.stringify(value, null, 2) } : server
}

/**
 * 提交前把 JSON 文本解析回对象，空值为 null，JSON 有误时抛出异常。只用于生成请求参数，不写回表单。
 * 有意修正：原版把解析结果写回表单，已经是对象时又会变成 false，所以保存失败后改正再提交，配置被提交成 false
 */
export function parseSettings<T extends NodeForm>(server: T, key: string): T {
  const value = server[key]
  return { ...server, [key]: value ? (typeof value === 'string' ? JSON.parse(value) : value) : null }
}
