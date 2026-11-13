// 导出 CSV 的兜底：后端 user/dumpCSV 直接 echo 文件内容，超过 PHP output_buffering（常见 4KB）时响应头已经发出，
// 跨域响应头丢失，前后端分离部署的浏览器拿不到结果。这时改为分页读取 user/fetch（同样的过滤条件，按 id 升序），
// 按后端 UserController@dumpCSV 相同的列、数字格式、日期时区、BOM 与 CRLF 生成（与后端输出逐字节相同）。
import { fetchUsers } from '@/api/services/user'
import type { AdminUser, FilterCondition } from '@/api/types'

const GB = 1073741824
const PAGE_SIZE = 500

export const USER_CSV_HEADER = '邮箱,余额,推广佣金,总流量,设备数限制,剩余流量,套餐到期时间,订阅计划,订阅地址\r\n'

// 后端的时区写死在 config/app.php（Asia/Shanghai），PHP date('Y-m-d H:i:s') 按它格式化
const SERVER_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** 按后端时区格式化 unix 秒：YYYY-MM-DD HH:mm:ss */
export function serverDateTime(seconds: number): string {
  const parts = Object.fromEntries(SERVER_TIME.formatToParts(new Date(seconds * 1000)).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

/**
 * PHP 把数字插入字符串的格式：整数原样输出；浮点数按 precision=14 位有效数字（去掉末尾的 0）。
 * 两个整数相除能整除时 PHP 得到整数，否则得到浮点数，这里按结果是否为整数区分，输出相同
 */
export function phpNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toPrecision(14)))
}

/** 后端导出的一行（原始数据：流量为字节、金额为分）。设备数限制一列后端读错了字段名，始终为空 */
export function userCsvLine(user: AdminUser): string {
  const raw = user as unknown as Record<string, number | string | null | undefined>
  const transfer = Number(raw.transfer_enable)
  const expiredAt = raw.expired_at === null ? '长期有效' : serverDateTime(Number(raw.expired_at))
  const balance = phpNumber(Number(raw.balance) / 100)
  const commission = phpNumber(Number(raw.commission_balance) / 100)
  const transferEnable = transfer ? phpNumber(transfer / GB) : '0'
  const notUseFlow = phpNumber((transfer - (Number(raw.u) + Number(raw.d))) / GB)
  const planName = user.plan_name ?? '无订阅'
  return `${user.email},${balance},${commission},${transferEnable}, , ${notUseFlow},${expiredAt},${planName},${user.subscribe_url ?? ''}\r\n`
}

export const buildUserCsv = (users: AdminUser[]) => `﻿${USER_CSV_HEADER}${users.map(userCsvLine).join('')}`

/** 分页读取全部符合条件的用户并生成 CSV；读取失败返回 undefined（提示已由请求层弹出） */
export async function buildUserCsvFallback(filter: FilterCondition[]): Promise<string | undefined> {
  const users: AdminUser[] = []
  for (let current = 1; ; current++) {
    const res = await fetchUsers({ filter, pageSize: PAGE_SIZE, current, sort_type: 'ASC', sort: 'id' })
    if (res.code !== 200) return undefined
    const rows = res.data ?? []
    users.push(...rows)
    if (rows.length < PAGE_SIZE || users.length >= (res.total ?? 0)) break
  }
  return buildUserCsv(users)
}
