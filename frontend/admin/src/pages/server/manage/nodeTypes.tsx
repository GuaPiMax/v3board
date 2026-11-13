import { Tag, Tooltip } from 'antd'
import type { CSSProperties, ReactNode } from 'react'
import type { NodeType } from '@/api/types'
import { AnyTLSDrawer } from './drawers/AnyTLSDrawer'
import { HysteriaDrawer } from './drawers/HysteriaDrawer'
import { ShadowsocksDrawer } from './drawers/ShadowsocksDrawer'
import type { NodeDrawerProps } from './drawers/shared'
import { TrojanDrawer } from './drawers/TrojanDrawer'
import { TuicDrawer } from './drawers/TuicDrawer'
import { PROTOCOLS, V2nodeDrawer } from './drawers/V2nodeDrawer'
import { VlessDrawer } from './drawers/VlessDrawer'
import { VmessDrawer } from './drawers/VmessDrawer'

/** 协议标签颜色（原版 getTypeTag） */
const TYPE_COLORS: Record<NodeType, string> = {
  shadowsocks: '#489851',
  vmess: '#CB3180',
  trojan: '#EAB854',
  hysteria: '#1A1A1A',
  tuic: '#9400D3',
  vless: '#4080FF',
  anytls: '#FF8C00',
  v2node: '#FF0000',
}

/** v2node 实际协议的颜色（沿用各协议独立节点的颜色；hysteria2 用 hysteria 的） */
const V2NODE_PROTOCOL_COLORS: Record<string, string> = {
  anytls: TYPE_COLORS.anytls,
  hysteria2: TYPE_COLORS.hysteria,
  shadowsocks: TYPE_COLORS.shadowsocks,
  trojan: TYPE_COLORS.trojan,
  tuic: TYPE_COLORS.tuic,
  vless: TYPE_COLORS.vless,
  vmess: TYPE_COLORS.vmess,
}

/**
 * 带协议颜色的标签（实心、白字）。
 * v2node 传入 protocol 时从右上角斜切下一条该协议的颜色，悬停显示协议名（有意新增，原版只有纯红）
 */
export function TypeTag({ type, protocol, children }: { type: NodeType; protocol?: unknown; children: ReactNode }) {
  const corner = type === 'v2node' && typeof protocol === 'string' ? V2NODE_PROTOCOL_COLORS[protocol] : undefined
  if (!corner) {
    return (
      <Tag color={TYPE_COLORS[type]} variant="solid">
        {children}
      </Tag>
    )
  }
  const label = PROTOCOLS.find((p) => p.value === protocol)?.label ?? protocol
  return (
    <Tooltip title={`V2node · ${label}`}>
      <Tag
        color={TYPE_COLORS[type]}
        variant="solid"
        className="v2b-node-corner"
        // antd 把自定义颜色的边框色写在行内，这里覆盖成透明，露出底下的背景（见 v2board.scss 的 .v2b-node-corner）
        style={{ '--v2b-node-corner': corner, borderColor: 'transparent' } as CSSProperties}
      >
        {children}
      </Tag>
    </Tooltip>
  )
}

/** 新建菜单（工具栏「+」）的顺序与文字 */
export const CREATE_MENU: Array<[NodeType, string]> = [
  ['v2node', 'V2node'],
  ['shadowsocks', 'Shadowsocks'],
  ['vmess', 'VMess'],
  ['trojan', 'Trojan'],
  ['hysteria', 'Hysteria'],
  ['tuic', 'Tuic'],
  ['vless', 'VLess'],
  ['anytls', 'AnyTLS'],
]

/** 「节点ID」列的协议筛选（与原版一致：筛选值转小写后与 type 比较） */
export const TYPE_FILTERS = ['V2node', 'Shadowsocks', 'Vmess', 'Trojan', 'Hysteria', 'Tuic', 'Vless', 'AnyTLS']

const DRAWERS: Record<NodeType, (props: NodeDrawerProps) => ReactNode> = {
  shadowsocks: ShadowsocksDrawer,
  vmess: VmessDrawer,
  trojan: TrojanDrawer,
  hysteria: HysteriaDrawer,
  tuic: TuicDrawer,
  vless: VlessDrawer,
  anytls: AnyTLSDrawer,
  v2node: V2nodeDrawer,
}

/** 按协议选择编辑抽屉 */
export function NodeDrawer({ type, ...props }: NodeDrawerProps & { type: NodeType }) {
  const Drawer = DRAWERS[type]
  return <Drawer {...props} />
}
