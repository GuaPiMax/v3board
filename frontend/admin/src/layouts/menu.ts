// 侧边栏菜单（顺序、文案、Simple Line Icons 图标与原版一致）
export type MenuEntry =
  | { type: 'heading'; title: string }
  | { type: 'item'; title: string; href: string; icon: string }

export const MENU: MenuEntry[] = [
  { type: 'item', title: '仪表盘', href: '/dashboard', icon: 'si-speedometer' },
  { type: 'heading', title: '设置' },
  { type: 'item', title: '系统配置', href: '/config/system', icon: 'si-equalizer' },
  { type: 'item', title: '支付配置', href: '/config/payment', icon: 'si-credit-card' },
  { type: 'item', title: '主题配置', href: '/config/theme', icon: 'si-magic-wand' },
  { type: 'heading', title: '服务器' },
  { type: 'item', title: '节点管理', href: '/server/manage', icon: 'si-layers' },
  { type: 'item', title: '第三方订阅', href: '/external-subscriptions', icon: 'si-link' },
  { type: 'item', title: '权限组管理', href: '/server/group', icon: 'si-wrench' },
  { type: 'item', title: '路由管理', href: '/server/route', icon: 'si-shuffle' },
  { type: 'heading', title: '财务' },
  { type: 'item', title: '订阅管理', href: '/plan', icon: 'si-bag' },
  { type: 'item', title: '订单管理', href: '/order', icon: 'si-list' },
  // v3board 独有
  { type: 'item', title: '提前续期记录', href: '/newPeriodLog', icon: 'si-refresh' },
  { type: 'item', title: '订阅覆盖记录', href: '/planChangeLog', icon: 'si-shuffle' },
  { type: 'item', title: '优惠券管理', href: '/coupon', icon: 'si-present' },
  { type: 'item', title: '礼品卡管理', href: '/giftcard', icon: 'si-star' },
  { type: 'heading', title: '用户' },
  { type: 'item', title: '用户管理', href: '/user', icon: 'si-users' },
  // v3board 独有
  { type: 'item', title: '风控中心', href: '/insiderGuard', icon: 'si-shield' },
  { type: 'item', title: '公告管理', href: '/notice', icon: 'si-speech' },
  { type: 'item', title: '工单管理', href: '/ticket', icon: 'si-support' },
  { type: 'item', title: '知识库管理', href: '/knowledge', icon: 'si-bulb' },
  { type: 'heading', title: '指标' },
  { type: 'item', title: '队列监控', href: '/queue', icon: 'si-bar-chart' },
]
