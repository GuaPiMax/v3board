// 顶栏的界面风格切换（原版没有）。按钮与菜单外框跟随当前风格（与账号菜单同一套写法）；菜单里每一项按各自的风格画成
// 小卡片，明暗跟随当前设置，显示的就是切过去之后的样子。选中后直接切换，不刷新页面（见 utils/darkMode 的 switchUi）。
// 卡片的颜色、描边、阴影都写在行内：当前风格的样式碰不到它们，经典的暗色下也不让 darkreader 转换（见 darkMode 的 FIXES）
import { useEffect, useState } from 'react'
import { THEME_PRIMARY } from '@/app/antdTheme'
import { UI_PRESET_OPTIONS } from '@/app/uiPreset'
import { useAppearanceStore } from '@/stores/appearance'
import { useThemeStore } from '@/stores/theme'
import { switchUi } from '@/utils/darkMode'

export function UiSwitch({ buttonClassName }: { buttonClassName: string }) {
  const ui = useAppearanceStore((s) => s.ui)
  const dark = useAppearanceStore((s) => s.dark)
  const primary = THEME_PRIMARY[useThemeStore((s) => s.theme.color)]
  const [open, setOpen] = useState(false)

  // 与账号菜单一致：展开后点击页面任意处（包括菜单里的选项）收起
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const timer = window.setTimeout(() => document.addEventListener('click', close, { once: true }))
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [open])

  return (
    <div className="dropdown d-inline-block v2b-ui-switch">
      <button
        type="button"
        className={buttonClassName}
        aria-label="界面风格"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="fa fa-fw fa-palette" />
      </button>
      <div className={`dropdown-menu dropdown-menu-right p-0${open ? ' show' : ''}`} role="menu" aria-label="界面风格">
        <div className="p-2">
          {UI_PRESET_OPTIONS.map(({ value, label, preview }) => {
            const p = preview(primary, dark)
            const current = value === ui
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                className="v2b-ui-option"
                style={{
                  background: p.background,
                  color: p.color,
                  border: p.border,
                  borderRadius: p.borderRadius,
                  boxShadow: p.boxShadow ?? 'none',
                  fontFamily: p.fontFamily,
                  fontWeight: p.fontWeight,
                  textShadow: p.textShadow ?? 'none',
                }}
                onClick={() => void switchUi(value)}
              >
                <span
                  className="v2b-ui-option-accent"
                  style={{ background: p.accent, border: p.accentBorder ?? 'none', borderRadius: p.accentRadius }}
                />
                <span className="v2b-ui-option-label">{label}</span>
                <i
                  className="fa fa-fw fa-check"
                  style={{ color: p.check, visibility: current ? 'visible' : 'hidden' }}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
