// 运行时配置：来自 public/config.js 的 window.settings（与原版 env.example.js 结构一致）。
// 界面预设不在这里配置：顶栏的主题按钮切换，存在浏览器里（见 stores/appearance）
export type ThemeMode = 'light' | 'dark'
export type ThemeColor = 'default' | 'darkblue' | 'black' | 'green'

export interface ThemeSettings {
  sidebar: ThemeMode
  header: ThemeMode
  color: ThemeColor
}

/**
 * 公开演示站（原版没有）：登录页预填并显示演示账号，顶栏标题旁显示 notice（空字符串时不显示）。
 * 不配置时为 null，界面与原版相同
 */
export interface DemoSettings {
  email: string
  password: string
  notice: string
}

export const DEFAULT_DEMO_NOTICE = '演示站 · 数据每小时整点复原'

export interface RuntimeSettings {
  title: string
  host: string
  secure_path: string
  theme: ThemeSettings
  background_url: string
  logo: string
  demo: DemoSettings | null
}

type RawSettings = Partial<Omit<RuntimeSettings, 'theme' | 'demo'>> & {
  theme?: Partial<ThemeSettings>
  demo?: Partial<DemoSettings>
}

declare global {
  interface Window {
    settings?: RawSettings
  }
}

const THEME_COLORS: ThemeColor[] = ['default', 'darkblue', 'black', 'green']

export function normalizeTheme(theme?: Partial<Record<keyof ThemeSettings, unknown>>): ThemeSettings {
  return {
    sidebar: theme?.sidebar === 'dark' ? 'dark' : 'light',
    header: theme?.header === 'light' ? 'light' : 'dark',
    color: THEME_COLORS.includes(theme?.color as ThemeColor) ? (theme?.color as ThemeColor) : 'default',
  }
}

const raw: RawSettings = window.settings ?? {}

export const settings: RuntimeSettings = {
  title: raw.title ?? '',
  host: (raw.host ?? '').replace(/\/+$/, ''),
  // 与原版一致：只去掉第一个 "/"
  secure_path: (raw.secure_path ?? '').replace('/', ''),
  theme: normalizeTheme(raw.theme),
  background_url: raw.background_url ?? '',
  logo: raw.logo ?? '',
  demo: raw.demo?.email
    ? { email: raw.demo.email, password: raw.demo.password ?? '', notice: raw.demo.notice ?? DEFAULT_DEMO_NOTICE }
    : null,
}

/** API 根地址：host 留空时与管理端同源 */
export const apiBase = `${settings.host || window.location.origin}/api/v1`

/** 管理接口路径：/{secure_path}/xxx */
export const adminPath = (path: string) => `/${settings.secure_path}${path}`
