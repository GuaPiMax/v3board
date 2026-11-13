// 请求层：行为与原版 umi.js（模块 t3Un）保持一致，便于新旧版请求逐字节比对。
//   - 请求头只带 authorization（裸 JWT，无 Bearer），后端 CORS 只放行少数头，不要加自定义头
//   - POST 默认 form-urlencoded（PHP 方括号语法），json=true 时发 JSON（仅节点排序使用）
//   - 仅当 content-type 恰为 application/json 时解析 JSON，否则按 ArrayBuffer 返回（CSV 导出）
//   - 403：清除 token 并回到登录页；其他非 200：弹出"请求失败"
import { apiBase } from '@/app/settings'
import { notification } from '@/app/staticApi'
import { getToken, removeToken } from '@/utils/storage'
import { stringify } from './qs'

export interface ApiResult<T = unknown> {
  code: number
  data?: T
  total?: number
  message?: string
  msg?: string
  buffer?: ArrayBuffer
  /** 网络 / 跨域失败（没有拿到响应） */
  networkError?: boolean
  [key: string]: unknown
}

/** 业务请求失败（错误提示已由请求层弹出） */
export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message = '请求失败',
  ) {
    super(message)
  }
}

interface RequestOptions {
  /** 网络 / 跨域失败时不弹通用提示，由调用方处理（返回 code 0 且 networkError 为 true） */
  silentNetworkError?: boolean
}

async function request<T>(url: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', token)
  // 与原版一致：包含 http 的视为完整地址（原版会在末尾补 ? / &），否则拼接 API 根地址
  const target = url.includes('http') ? `${url}${url.indexOf('?') > 0 ? '&' : '?'}` : apiBase + url

  let res: Response
  try {
    res = await fetch(target, { ...init, headers, credentials: 'include' })
  } catch {
    const msg = '无法连接到后端，请检查 config.js 中的 host，或后端是否允许跨域访问'
    if (!options.silentNetworkError) notification.error({ title: '请求失败', description: msg, duration: 3 })
    return { code: 0, msg, networkError: true }
  }

  let body: Record<string, unknown>
  if (res.headers.get('content-type') === 'application/json') {
    body = (await res.json()) as Record<string, unknown>
  } else {
    body = { buffer: await res.arrayBuffer() }
  }

  if (res.status === 403) {
    removeToken()
    window.location.href = window.location.origin + window.location.pathname
    return { code: res.status, msg: body.message as string | undefined }
  }
  if (res.status !== 200) {
    const errors = body.errors as Record<string, string[]> | undefined
    const msg = errors ? Object.values(errors)[0]?.[0] : (body.message as string | undefined)
    notification.error({ title: '请求失败', description: msg, duration: 1.5 })
    return { code: res.status, msg }
  }
  return { code: res.status, ...body } as ApiResult<T>
}

export function get<T>(url: string, params?: object) {
  const query = stringify(params)
  return request<T>(query ? `${url}${url.indexOf('?') > 0 ? '&' : '?'}${query}` : url)
}

export function post<T>(url: string, data?: object, json = false, options?: RequestOptions) {
  return request<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' },
      body: json ? JSON.stringify(data) : stringify(data),
    },
    options,
  )
}

/** 取出 data；失败时抛 ApiError（提示已弹出），供 TanStack Query 使用 */
export async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const res = await promise
  if (res.code !== 200) throw new ApiError(res.code, res.msg)
  return res.data as T
}
