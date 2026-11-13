import { describe, expect, it } from 'vitest'
import worker from '../worker/index'
import { renderConfigJs, settingsFromEnv } from '../worker/config'

/** config.js 里 window.settings 的值 */
const settingsOf = (source: string) => JSON.parse(source.split('window.settings = ')[1])

const DEFAULTS = {
  title: 'V2Board',
  host: '',
  secure_path: 'admin',
  theme: { sidebar: 'light', header: 'dark', color: 'default' },
  background_url: '',
  logo: '',
}

describe('运行时配置：按 V2B_* 变量生成 window.settings（打包与 Worker 共用）', () => {
  it('没有设置的变量使用默认值（与 public/config.example.js 相同），不带 demo', () => {
    expect(settingsFromEnv({})).toEqual(DEFAULTS)
  })

  it('按变量填入各字段', () => {
    const env = {
      V2B_TITLE: '我的面板',
      V2B_API_HOST: 'https://api.example.com',
      V2B_THEME_SIDEBAR: 'dark',
      V2B_THEME_HEADER: 'light',
      V2B_THEME_COLOR: 'green',
      V2B_BACKGROUND_URL: 'https://example.com/bg.jpg',
      V2B_LOGO: 'https://example.com/logo.png',
      V2B_SECURE_PATH: 'secret-path',
    }
    expect(settingsFromEnv(env)).toEqual({
      title: '我的面板',
      host: 'https://api.example.com',
      secure_path: 'secret-path',
      theme: { sidebar: 'dark', header: 'light', color: 'green' },
      background_url: 'https://example.com/bg.jpg',
      logo: 'https://example.com/logo.png',
    })
  })

  it('演示账号：设置了邮箱才有 demo；没设置提示时不带 notice，设置为空字符串时带上（不显示）', () => {
    expect(settingsFromEnv({ V2B_DEMO_EMAIL: 'admin@example.com' }).demo).toEqual({ email: 'admin@example.com', password: '' })
    expect(
      settingsFromEnv({ V2B_DEMO_EMAIL: 'admin@example.com', V2B_DEMO_PASSWORD: 'pass', V2B_DEMO_NOTICE: '' }).demo,
    ).toEqual({ email: 'admin@example.com', password: 'pass', notice: '' })
    expect(settingsFromEnv({ V2B_DEMO_PASSWORD: 'pass' })).not.toHaveProperty('demo')
  })

  it('config.js：第一行是说明注释，window.settings 为两空格缩进的 JSON，以换行结尾', () => {
    const source = renderConfigJs({ V2B_API_HOST: 'https://api.example.com' }, '说明')
    expect(source.startsWith('// 说明\nwindow.settings = {\n  "title": "V2Board",\n')).toBe(true)
    expect(source.endsWith('\n}\n')).toBe(true)
    expect(settingsOf(source)).toEqual({ ...DEFAULTS, host: 'https://api.example.com' })
  })
})

describe('Cloudflare Worker', () => {
  const env = { V2B_API_HOST: 'https://api.example.com', V2B_SECURE_PATH: 'secret-path', V2B_DEMO_EMAIL: 'admin@example.com' }

  it('/config.js 按变量生成，带上与 _headers 相同的响应头（带查询串也一样）', async () => {
    for (const url of ['https://admin.example.com/config.js', 'https://admin.example.com/config.js?t=1']) {
      const res = worker.fetch(new Request(url), env)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/javascript; charset=utf-8')
      expect(res.headers.get('Cache-Control')).toBe('no-cache')
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
      const source = await res.text()
      expect(source.split('\n')[0]).toContain('Worker 的「设置 → 变量和机密」')
      expect(settingsOf(source)).toEqual({
        ...DEFAULTS,
        host: 'https://api.example.com',
        secure_path: 'secret-path',
        demo: { email: 'admin@example.com', password: '' },
      })
    }
  })

  it('其他路径（静态资源里没有的文件）返回 404', () => {
    for (const path of ['/nope', '/api/v1/guest/comm/config', '/config.json']) {
      expect(worker.fetch(new Request(`https://admin.example.com${path}`), env).status).toBe(404)
    }
  })
})
