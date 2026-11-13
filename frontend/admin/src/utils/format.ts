import dayjs from 'dayjs'

/** 原版的字节格式化：>1GB 显示 GB，依次 MB / KB / B，保留两位小数 */
export function formatBytes(input: number | string = 0): string | number {
  const n = Number.parseInt(String(input), 10)
  const KB = 1024
  const MB = 1048576
  const GB = 1073741824
  if (n > GB) return `${(n / GB).toFixed(2)} GB`
  if (n > MB) return `${(n / MB).toFixed(2)} MB`
  if (n > KB) return `${(n / KB).toFixed(2)} KB`
  if (n < 0) return 0
  return `${n.toFixed(2)} B`
}

/** unix 秒 → YYYY/MM/DD HH:mm（原版列表通用格式） */
export const formatTime = (seconds: number, pattern = 'YYYY/MM/DD HH:mm') => dayjs(seconds * 1000).format(pattern)

/** 分 → 元，保留两位小数 */
export const centsToYuan = (cents: number | null | undefined) => (cents ? (cents / 100).toFixed(2) : '0.00')
