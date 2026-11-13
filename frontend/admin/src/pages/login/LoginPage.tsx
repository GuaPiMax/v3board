import { LoadingOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { login as loginApi } from '@/api/services/passport'
import { checkLogin } from '@/api/services/self'
import { settings } from '@/app/settings'
import { message, modal } from '@/app/staticApi'
import { JsLink } from '@/components/JsLink'
import { useBrandingStore } from '@/stores/branding'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'
import { getToken, setToken } from '@/utils/storage'

const forgotPassword = () =>
  modal.info({
    title: '忘记密码',
    content: (
      <div>
        <div>在站点目录下执行命令找回密码</div>
        <code>php artisan reset:password 管理员邮箱</code>
      </div>
    ),
    centered: true,
    okText: '我知道了',
    onOk() {},
  })

// 登录页（原版模块 SGa5）
export default function LoginPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const redirect = new URLSearchParams(search).get('redirect') ?? undefined
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const title = useBrandingStore((s) => s.title)
  const logo = useBrandingStore((s) => s.logo)
  const backgroundUrl = useThemeStore((s) => s.backgroundUrl)
  // 公开演示站（原版没有）：预填并显示演示账号
  const demo = settings.demo

  const login = async () => {
    setLoading(true)
    const res = await loginApi(emailRef.current?.value ?? '', passwordRef.current?.value ?? '')
    setLoading(false)
    if (res.code !== 200 || !res.data) return
    // 有意修正：原版会先保存 token 再判断是否管理员，非管理员时既不提示也不跳转
    if (!res.data.is_admin) {
      message.error('该账号不是管理员')
      return
    }
    setToken(res.data.auth_data)
    navigate('/dashboard')
    void useUserStore.getState().loadUserInfo()
  }
  const loginRef = useRef(login)
  loginRef.current = login

  useEffect(() => {
    // 已登录的管理员直接进入（原版 user/checkLogin）
    if (getToken()) {
      void checkLogin().then((res) => {
        if (res.code !== 200 || !res.data?.is_admin) return
        void useUserStore.getState().loadUserInfo()
        navigate(redirect || '/dashboard')
      })
    }
    // 与原版一致：页面任意位置按回车即登录
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') void loginRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div id="page-container">
      <main id="main-container">
        <div
          className="v2board-background"
          style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined }}
        />
        <div className="no-gutters v2board-auth-box">
          <div className="" style={{ maxWidth: 450, width: '100%', margin: 'auto' }}>
            <div className="mx-2 mx-sm-0">
              <div
                className="block block-rounded block-transparent block-fx-pop w-100 mb-0 overflow-hidden bg-image"
                style={{ boxShadow: '0 0.5rem 2rem #0000000d' }}
              >
                <div className="row no-gutters">
                  <div className="col-md-12 order-md-1 bg-white">
                    <div className="block-content block-content-full px-lg-4 py-md-4 py-lg-4">
                      <div className="mb-3 text-center">
                        <JsLink className="font-size-h1">
                          {logo ? (
                            <img className="v2board-logo mb-3" src={logo} />
                          ) : (
                            <span className="text-dark">{title || 'V2Board'}</span>
                          )}
                        </JsLink>
                        <p className="font-size-sm text-muted mb-3">登录到管理中心</p>
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          className="form-control form-control-alt"
                          placeholder="邮箱"
                          ref={emailRef}
                          defaultValue={demo?.email}
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="password"
                          className="form-control form-control-alt"
                          placeholder="密码"
                          ref={passwordRef}
                          defaultValue={demo?.password}
                        />
                      </div>
                      <div className="form-group mb-0">
                        <button
                          disabled={loading}
                          type="submit"
                          className="btn btn-block btn-primary font-w400"
                          onClick={() => void login()}
                        >
                          {loading ? (
                            <LoadingOutlined />
                          ) : (
                            <span>
                              <i className="si si-login mr-1" />
                              登入
                            </span>
                          )}
                        </button>
                      </div>
                      {demo && (
                        <div className="font-size-sm text-muted text-center mt-3">
                          <div>
                            演示账号：{demo.email} / {demo.password}
                          </div>
                          {demo.notice && <div>{demo.notice}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-center bg-gray-lighter p-3 px-4">
                  <a onClick={forgotPassword}>忘记密码</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
