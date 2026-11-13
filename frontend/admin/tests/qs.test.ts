import { describe, expect, it } from 'vitest'
import { stringify } from '../src/api/qs'

// 对照标准：原版 umi.js 模块 t3Un 里的序列化函数（逐字搬运，仅改为 TS 可编译的写法）
/* oxlint-disable unicorn/consistent-function-scoping, unicorn/no-instanceof-builtins */
function legacyStringify(e: unknown): string {
  const m = (key: string, value: unknown, out: string[]): void => {
    if (value !== null) {
      if (typeof value !== 'undefined') {
        if (typeof value === 'object') {
          for (const r in value as Record<string, unknown>) m(`${key}[${r}]`, (value as Record<string, unknown>)[r], out)
        } else out.push(`${key}=${encodeURIComponent(value as string)}`)
      }
    } else out.push(`${key}=`)
  }
  if (!e) return ''
  if (typeof e === 'object' && !(e instanceof Array)) {
    const t: string[] = []
    for (const n in e as Record<string, unknown>) m(n, (e as Record<string, unknown>)[n], t)
    return t.join('&')
  }
  return ''
}
/* oxlint-enable unicorn/consistent-function-scoping, unicorn/no-instanceof-builtins */

const cases: Array<[string, unknown]> = [
  ['空值', undefined],
  ['空对象', {}],
  ['顶层数组', [1, 2]],
  ['简单字段', { email: 'a@b.com', password: 'p@ss word&=' }],
  ['null 与 undefined', { a: null, b: undefined, c: 0, d: '' }],
  ['布尔与数字', { show: true, off: false, n: 1.5 }],
  ['数组', { tags: ['标签1', 'b c'], ids: [1, 2, 3] }],
  ['空数组', { tags: [] }],
  ['嵌套对象', { filter: [{ key: 'email', condition: '模糊', value: 'x' }], sort: { created_at: 'DESC' } }],
  ['深层嵌套', { config: { tls: { server_name: 'a.com', alpn: ['h2', 'http/1.1'] }, n: null } }],
  ['特殊字符', { content: '<p>A&B=1 100%</p>', url: 'https://example.com/a.png?x=1&y=2' }],
]

describe('qs.stringify 与原版序列化逐字一致', () => {
  for (const [name, input] of cases) {
    it(name, () => {
      expect(stringify(input)).toBe(legacyStringify(input))
    })
  }

  it('示例：PHP 方括号语法', () => {
    expect(stringify({ filter: [{ key: 'id', condition: '>', value: 10 }] })).toBe(
      'filter[0][key]=id&filter[0][condition]=%3E&filter[0][value]=10',
    )
  })
})
