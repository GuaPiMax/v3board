// localStorage：token（与原版同名 key，便于迁移）与使用习惯（分页大小等）
const TOKEN_KEY = 'authorization'
const HABIT_KEY = 'habit'

export const getToken = () => window.localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => window.localStorage.setItem(TOKEN_KEY, token)
export const removeToken = () => window.localStorage.removeItem(TOKEN_KEY)

function readHabit(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(HABIT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// 原版写入时会丢掉其他 key（对字符串赋属性），这里按预期合并保存
export function setHabit(key: string, value: unknown) {
  window.localStorage.setItem(HABIT_KEY, JSON.stringify({ ...readHabit(), [key]: value }))
}

export function getHabit<T = unknown>(key: string): T | undefined {
  return readHabit()[key] as T | undefined
}
