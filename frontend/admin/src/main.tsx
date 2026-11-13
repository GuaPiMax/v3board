import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { createRoot } from 'react-dom/client'
import './styles/index.scss'
import { App } from './app/App'
import { useThemeStore } from './stores/theme'
import { applyInitialAppearance } from './utils/darkMode'

dayjs.locale('zh-cn')
// 首屏渲染前应用界面预设、主题色与暗黑模式，避免闪烁
document.documentElement.dataset.v2bColor = useThemeStore.getState().theme.color
// darkreader 下载失败时照常渲染（亮色）
await applyInitialAppearance().catch(() => undefined)

createRoot(document.getElementById('root')!).render(<App />)
