import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { ThemeInfo } from '../types'

/** themes：主题目录名 → config.json；active：当前使用的主题（系统配置 frontend_theme） */
export const getThemes = () => get<{ themes: Record<string, ThemeInfo>; active: string }>(adminPath('/theme/getThemes'))
export const getThemeConfig = (name: string) =>
  post<Record<string, string>>(adminPath('/theme/getThemeConfig'), { name })
/** config：JSON 字符串的 base64（按 UTF-8 编码） */
export const saveThemeConfig = (config: string, name: string) =>
  post<Record<string, string>>(adminPath('/theme/saveThemeConfig'), { config, name })
