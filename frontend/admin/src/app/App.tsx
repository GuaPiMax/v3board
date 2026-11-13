import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useEffect, useMemo } from 'react'
// 浏览器环境使用 react-router/dom 的 RouterProvider（接入了 ReactDOM.flushSync）
import { RouterProvider } from 'react-router/dom'
import { useUi } from '@/stores/appearance'
import { useBrandingStore } from '@/stores/branding'
import { useThemeStore } from '@/stores/theme'
import { useSkinDark, useSyncAppearance } from '@/utils/darkMode'
import { buildAntdTheme, buildAppConfig, buildComponentConfig } from './antdTheme'
import { router } from './router'
import { StaticApiHolder } from './staticApi'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
})

export function App() {
  const color = useThemeStore((s) => s.theme.color)
  const title = useBrandingStore((s) => s.title)
  // 界面预设可以在运行中切换（顶栏的主题按钮）；皮肤的暗色版换 antd 主题（legacy 的暗黑模式由 darkreader 处理，这里始终为 false）
  const ui = useUi()
  const dark = useSkinDark()
  const theme = useMemo(() => buildAntdTheme(color, ui, dark), [color, ui, dark])
  const componentConfig = useMemo(() => buildComponentConfig(ui), [ui])
  const appConfig = useMemo(() => buildAppConfig(ui), [ui])
  // <html> 的 data-v2b-ui / data-v2b-dark 与 darkreader，与上面的主题在同一次提交里生效
  useSyncAppearance()

  useEffect(() => {
    document.documentElement.dataset.v2bColor = color
  }, [color])

  useEffect(() => {
    document.title = title || 'V2Board'
  }, [title])

  return (
    <ConfigProvider locale={zhCN} theme={theme} {...componentConfig}>
      <AntdApp {...appConfig}>
        <StaticApiHolder />
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  )
}
