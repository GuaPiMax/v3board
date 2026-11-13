// 前后端分离后，原版由 blade 注入的主题 / 站点信息改为登录后从后端读取：
//   - frontend 分组 → 边栏 / 顶栏风格、主题色、登录页背景（写入缓存，下次登录页直接使用）
//   - site 分组 → config.js 未填写 title / logo 时使用后端「站点名称 / LOGO」
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { settings } from '@/app/settings'
import { unwrap } from '@/api/request'
import { fetchConfig } from '@/api/services/config'
import { useBrandingStore } from '@/stores/branding'
import { useThemeStore } from '@/stores/theme'

export function useBackendFrontendSettings() {
  const frontend = useQuery({
    queryKey: ['config', 'frontend'],
    queryFn: () => unwrap(fetchConfig('frontend')),
    staleTime: Infinity,
  })
  const needSite = !settings.title || !settings.logo
  const site = useQuery({
    queryKey: ['config', 'site'],
    queryFn: () => unwrap(fetchConfig('site')),
    staleTime: Infinity,
    enabled: needSite,
  })

  useEffect(() => {
    if (frontend.data?.frontend) useThemeStore.getState().applyBackendFrontend(frontend.data.frontend)
  }, [frontend.data])

  useEffect(() => {
    if (site.data?.site) useBrandingStore.getState().applySite(site.data.site)
  }, [site.data])
}
