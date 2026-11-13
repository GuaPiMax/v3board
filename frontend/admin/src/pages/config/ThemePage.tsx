import { useEffect } from 'react'
import { saveConfig } from '@/api/services/config'
import { AdminLayout } from '@/layouts/AdminLayout'
import { useThemeManageStore } from '@/stores/themeManage'
import { ThemeConfigModal } from './ThemeConfigModal'

// 原版所有主题卡片共用的背景图（不是主题 config.json 里的 images）
const CARD_BACKGROUND =
  'url(https://images.unsplash.com/photo-1567095761054-7a02e69e5c43?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1374&q=80)'

/** 激活主题：保存系统配置的 frontend_theme，成功后重新读取主题列表 */
async function activeTheme(name: string) {
  const res = await saveConfig({ frontend_theme: name })
  if (res.code !== 200) return
  void useThemeManageStore.getState().getThemes()
}

// 主题配置（原版模块 8drl + model theme）。与原版一致：还没读取到主题时整页显示加载中
export default function ThemePage() {
  const { themes, active } = useThemeManageStore()

  useEffect(() => {
    void useThemeManageStore.getState().getThemes()
  }, [])

  return (
    <AdminLayout title="主题配置" loading={Object.keys(themes).length <= 0}>
      <div className="row">
        <div className="col-lg-12">
          <div className="alert alert-warning mb-0 mb-md-4" role="alert">
            <p className="mb-0">
              如果你采用前后分离的方式部署V2board，那么主题配置将不会生效。了解
              <b>
                <a href="https://docs.v2board.com/use/advanced.html#%E5%89%8D%E7%AB%AF%E5%88%86%E7%A6%BB">前后分离</a>
              </b>
            </p>
          </div>
        </div>
      </div>
      {Object.keys(themes).map((key) => {
        const theme = themes[key]
        return (
          <div
            key={key}
            className="block block-transparent bg-image mb-0 mb-md-3 bg-primary"
            style={{ backgroundImage: CARD_BACKGROUND }}
          >
            <div className="block-content block-content-full bg-gd-white-op-l">
              <div className="d-md-flex justify-content-md-between align-items-md-center">
                <div className="p-2 py-4">
                  <h3 className="font-size-h4 font-w400 text-black mb-1">{theme.name}</h3>
                  <p className="text-black-75 mb-0">{theme.description}</p>
                </div>
                <div className="p-2 py-4">
                  <button
                    type="button"
                    className="btn btn-sm rounded-pill btn-outline-light px-3 mr-2"
                    onClick={() => void activeTheme(key)}
                    disabled={active === key}
                  >
                    {active === key ? '当前主题' : '激活主题'}
                  </button>
                  <ThemeConfigModal keyName={key} themeName={theme.name} configs={theme.configs}>
                    <button type="button" className="btn btn-sm rounded-pill btn-outline-light px-3">
                      主题设置
                    </button>
                  </ThemeConfigModal>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </AdminLayout>
  )
}
