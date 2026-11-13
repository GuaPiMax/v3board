import { beforeEach, describe, expect, it, vi } from 'vitest'

// 请求层依赖 window / localStorage / antd 静态方法，这里用最小桩替代
const notificationError = vi.fn()
vi.mock('../src/app/staticApi', () => ({ notification: { error: notificationError } }))
vi.mock('../src/app/settings', () => ({ apiBase: 'http://api.test/api/v1' }))

const store = new Map<string, string>()
const location = { origin: 'http://admin.test', pathname: '/', href: 'http://admin.test/#/notice' }
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  },
  location,
})

const { get, post } = await import('../src/api/request')

function mockFetch(status: number, body: unknown, contentType = 'application/json') {
  const fn = vi.fn(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': contentType },
      }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  store.clear()
  notificationError.mockClear()
  location.href = 'http://admin.test/#/notice'
})

describe('request', () => {
  it('GET：拼接 API 根地址与查询串，携带裸 token，credentials=include', async () => {
    store.set('authorization', 'jwt-token')
    const fetch = mockFetch(200, { data: [1], total: 1 })
    const res = await get('/devadmin123/notice/fetch', { key: 'site' })
    expect(res).toEqual({ code: 200, data: [1], total: 1 })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api.test/api/v1/devadmin123/notice/fetch?key=site')
    expect(new Headers(init.headers).get('authorization')).toBe('jwt-token')
    expect(init.credentials).toBe('include')
  })

  it('POST 默认 form-urlencoded，json=true 时发 JSON', async () => {
    const fetch = mockFetch(200, { data: true })
    await post('/x/save', { id: 1, tags: ['a'] })
    let init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(new Headers(init.headers).get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBe('id=1&tags[0]=a')
    await post('/server/manage/sort', { vmess: { 1: 0 } }, true)
    init = (fetch.mock.calls[1] as unknown as [string, RequestInit])[1]
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
    expect(init.body).toBe('{"vmess":{"1":0}}')
  })

  it('完整地址（含 http）原样使用并补 ?（与原版一致）', async () => {
    const fetch = mockFetch(200, { status: 'running' })
    const res = await get('http://api.test/monitor/api/stats')
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('http://api.test/monitor/api/stats?')
    expect(res.status).toBe('running')
  })

  it('403：清除 token 并回到登录页', async () => {
    store.set('authorization', 'expired')
    mockFetch(403, { message: '未登录或登陆已过期' })
    const res = await get('/x')
    expect(res.code).toBe(403)
    expect(store.has('authorization')).toBe(false)
    expect(location.href).toBe('http://admin.test/')
    expect(notificationError).not.toHaveBeenCalled()
  })

  it('422：提示 errors 的第一条', async () => {
    mockFetch(422, { message: 'The given data was invalid.', errors: { title: ['标题不能为空'] } })
    const res = await post('/x', {})
    expect(res).toEqual({ code: 422, msg: '标题不能为空' })
    expect(notificationError).toHaveBeenCalledWith({ title: '请求失败', description: '标题不能为空', duration: 1.5 })
  })

  it('500：提示 message', async () => {
    mockFetch(500, { message: '邮箱已存在于系统中' })
    const res = await post('/x', {})
    expect(res.msg).toBe('邮箱已存在于系统中')
    expect(notificationError).toHaveBeenCalledWith({ title: '请求失败', description: '邮箱已存在于系统中', duration: 1.5 })
  })

  it('非 JSON 响应按 ArrayBuffer 返回（CSV 导出）', async () => {
    mockFetch(200, '﻿邮箱,余额\r\n', 'text/html; charset=UTF-8')
    const res = await post('/x/dumpCSV', {})
    expect(res.code).toBe(200)
    expect(res.buffer).toBeInstanceOf(ArrayBuffer)
  })

  it('网络 / 跨域失败时给出提示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const res = await get('/x')
    expect(res.code).toBe(0)
    expect(notificationError).toHaveBeenCalled()
  })
})
