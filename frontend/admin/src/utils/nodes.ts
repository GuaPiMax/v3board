// 节点的协议徽标与 type:id 编解码（各协议的 id 互相独立）：风控中心、订阅节点 UA 白名单规则共用
import type { NodeType } from '@/api/types'

/** 节点协议的短徽标 */
const TYPE_BADGE: Record<NodeType, string> = {
  shadowsocks: 'SS',
  vmess: 'VMess',
  vless: 'VLESS',
  trojan: 'Trojan',
  tuic: 'TUIC',
  hysteria: 'Hysteria',
  anytls: 'AnyTLS',
  v2node: 'V2Node',
}
export const typeBadge = (type: string) => TYPE_BADGE[type as NodeType] ?? type

/** 节点在下拉框 / 规则里的标识：type:id */
export interface NodeRef {
  type: NodeType
  id: number
}
export const nodeKey = (node: { type: string; id: number | string }) => `${node.type}:${node.id}`
export function parseNodeKey(key: string): NodeRef {
  const [type, id] = key.split(':')
  return { type: type as NodeType, id: Number(id) }
}
