// 站点标题 / LOGO：config.js 非空时优先；留空时登录后取后端「站点名称 / LOGO」
import { create } from 'zustand'
import { settings } from '@/app/settings'

interface BrandingState {
  title: string
  logo: string
  applySite: (site: Record<string, unknown>) => void
}

export const useBrandingStore = create<BrandingState>((set) => ({
  title: settings.title,
  logo: settings.logo,
  applySite: (site) =>
    set({
      title: settings.title || (typeof site.app_name === 'string' ? site.app_name : ''),
      logo: settings.logo || (typeof site.logo === 'string' ? site.logo : ''),
    }),
}))

/** 与原版一致：标题为空时显示 V2Board */
export const useSiteTitle = () => useBrandingStore((s) => s.title) || 'V2Board'
