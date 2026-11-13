// 与原版请求层完全一致的参数序列化（PHP 方括号语法）：
//   - key 不编码，value 用 encodeURIComponent
//   - null → `key=`，undefined 省略，对象 / 数组递归展开为 key[子键]
//   - 顶层不是普通对象（数组、空值）时返回空串
function append(key: string, value: unknown, out: string[]) {
  if (value === null) {
    out.push(`${key}=`)
    return
  }
  if (typeof value === 'undefined') return
  if (typeof value === 'object') {
    for (const k in value as Record<string, unknown>) append(`${key}[${k}]`, (value as Record<string, unknown>)[k], out)
    return
  }
  out.push(`${key}=${encodeURIComponent(value as string | number | boolean)}`)
}

export function stringify(data: unknown): string {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ''
  const out: string[] = []
  for (const k in data as Record<string, unknown>) append(k, (data as Record<string, unknown>)[k], out)
  return out.join('&')
}
