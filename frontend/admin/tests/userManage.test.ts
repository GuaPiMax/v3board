import { beforeEach, describe, expect, it, vi } from 'vitest'

// 导出 CSV 的日期固定按后端时区（Asia/Shanghai）格式化，与运行环境的时区无关
process.env.TZ = 'Asia/Singapore'

const updateUser = vi.fn(async (_params: object) => ({ code: 200 }))
const fetchUsers = vi.fn(async (_params: object) => ({ code: 200, data: [], total: 0 }))
const fetchOrders = vi.fn(async (_params: object) => ({ code: 200, data: [], total: 150 }))
vi.mock('../src/api/services/user', () => ({ updateUser, fetchUsers }))
vi.mock('../src/api/services/order', () => ({ fetchOrders }))
vi.mock('../src/app/staticApi', () => ({ message: {}, notification: {} }))
vi.mock('../src/utils/storage', () => ({ getHabit: () => undefined }))

const { phpNumber, userCsvLine, buildUserCsv, USER_CSV_HEADER } = await import('../src/pages/user/userCsv')
const { useUserManageStore } = await import('../src/stores/userManage')
const { useOrderManageStore } = await import('../src/stores/orderManage')

const GB = 1073741824
const user = (fields: Record<string, unknown>) => fields as never

describe('导出 CSV 兜底（与后端 UserController@dumpCSV 输出相同）', () => {
  it('数字按 PHP 插入字符串的格式', () => {
    // 期望值由 php -r 'echo ...;' 得到
    expect(phpNumber(1000000000 / GB)).toBe('0.93132257461548')
    expect(phpNumber((1000000000 - 3000000005) / GB)).toBe('-1.8626451538876')
    expect(phpNumber(1234 / 100)).toBe('12.34')
    expect(phpNumber(5 / 100)).toBe('0.05')
    expect(phpNumber(107374182400 / GB)).toBe('100')
    expect(phpNumber(0)).toBe('0')
  })

  it('逐行与后端导出的内容一致', () => {
    // 两行取自 v2b-demo 演示数据的 user/dumpCSV 输出
    expect(
      userCsvLine(
        user({
          email: 'admin@example.com',
          balance: 0,
          commission_balance: 0,
          transfer_enable: 0,
          u: 0,
          d: 0,
          expired_at: 0,
          subscribe_url: 'http://localhost:6600/api/v1/client/subscribe?token=feda9f09d9ec888de364d521ab49eec4',
        }),
      ),
    ).toBe(
      'admin@example.com,0,0,0, , 0,1970-01-01 08:00:00,无订阅,http://localhost:6600/api/v1/client/subscribe?token=feda9f09d9ec888de364d521ab49eec4\r\n',
    )
    expect(
      userCsvLine(
        user({
          email: 'user001@example.com',
          balance: 0,
          commission_balance: 4900,
          transfer_enable: 107374182400,
          u: 1771674009,
          d: 14334453351,
          expired_at: 1815474278,
          plan_name: '基础套餐',
          subscribe_url: 'http://localhost:6600/api/v1/client/subscribe?token=d1386586a614ba91df3320b2170c0881',
        }),
      ),
    ).toBe(
      'user001@example.com,0,49,100, , 85,2027-07-13 18:24:38,基础套餐,http://localhost:6600/api/v1/client/subscribe?token=d1386586a614ba91df3320b2170c0881\r\n',
    )
  })

  it('长期有效、小数金额与超额流量', () => {
    expect(
      userCsvLine(
        user({ email: 'a@b.c', balance: 1234, commission_balance: 5, transfer_enable: 1000000000, u: 3000000000, d: 5, expired_at: null, subscribe_url: 'x' }),
      ),
    ).toBe('a@b.c,12.34,0.05,0.93132257461548, , -1.8626451538876,长期有效,无订阅,x\r\n')
  })

  it('带 UTF-8 BOM 与表头', () => {
    expect(buildUserCsv([])).toBe(`﻿${USER_CSV_HEADER}`)
    expect(USER_CSV_HEADER.endsWith('\r\n')).toBe(true)
  })
})

// 读取到的原始记录（流量为字节、金额为分）与表单里的显示值（保留两位小数的 GB / 元）
const loaded = {
  id: 218,
  balance: 1234,
  commission_balance: 10,
  u: 1610612736,
  d: 354334802,
  transfer_enable: 1000000000,
}
const form = (fields: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 218,
  invite_user_id: 12,
  email: 'u@example.com',
  password: '',
  balance: '12.34',
  commission_balance: '0.10',
  u: '1.50',
  d: '0.33',
  transfer_enable: '0.93',
  invite_user: { id: 12 },
  invite_user_email: 'i@example.com',
  ...fields,
})

describe('用户编辑提交（model user 的 update）', () => {
  beforeEach(() => updateUser.mockClear())

  it('没有改动的流量与金额按读取时的原值提交，去掉 invite_user，字段顺序不变', async () => {
    useUserManageStore.setState({ loadedUser: loaded })
    await useUserManageStore.getState().update(form())
    const payload = updateUser.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(payload)).toEqual([
      'id',
      'invite_user_id',
      'email',
      'password',
      'balance',
      'commission_balance',
      'u',
      'd',
      'transfer_enable',
      'invite_user_email',
    ])
    // 原版按显示值换算：0.93GB 会变成 998579896 字节
    expect(payload).toMatchObject({ transfer_enable: 1000000000, u: 1610612736, d: 354334802, balance: 1234, commission_balance: 10 })
  })

  it('改动过的字段按显示单位换算并取整', async () => {
    useUserManageStore.setState({ loadedUser: loaded })
    await useUserManageStore.getState().update(form({ transfer_enable: '10.5', d: '0.1', balance: '12.345' }))
    const payload = updateUser.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({
      transfer_enable: Math.round(10.5 * GB),
      d: Math.round(0.1 * GB),
      balance: 1235,
      u: 1610612736,
      commission_balance: 10,
    })
    expect(Number.isInteger(payload.d)).toBe(true)
  })

  it('读取到的记录不是这个用户时一律按显示值换算', async () => {
    useUserManageStore.setState({ loadedUser: { ...loaded, id: 1 } })
    await useUserManageStore.getState().update(form())
    const payload = updateUser.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toMatchObject({ transfer_enable: Math.round(0.93 * GB), u: Math.round(1.5 * GB), balance: 1234 })
  })
})

describe('订单列表分页与跳转过滤', () => {
  beforeEach(() => fetchOrders.mockClear())

  it('第一次进入订单页就请求第 1 页（原版为 current=0）', async () => {
    await useOrderManageStore.getState().fetch()
    expect(fetchOrders.mock.calls[0][0]).toEqual({ filter: [], pageSize: 10, current: 1 })
  })

  it('跳转前设置条件不拉取，订单页挂载时拉取一次（原版每追加一个条件拉取一次）', async () => {
    const store = useOrderManageStore
    store.getState().empty()
    store.getState().changeTable({ current: 3 })
    fetchOrders.mockClear()
    const filter = [
      { key: 'status', condition: '=', value: '3' },
      { key: 'commission_status', condition: '=', value: '0' },
    ]
    store.getState().presetFilter(filter)
    expect(fetchOrders).not.toHaveBeenCalled()
    expect(store.getState().pagination.current).toBe(1)
    await store.getState().fetch()
    expect(fetchOrders).toHaveBeenCalledTimes(1)
    expect(fetchOrders.mock.calls[0][0]).toEqual({ filter, pageSize: 10, current: 1 })
  })

  it('离开页面重置后仍从第 1 页开始', async () => {
    const store = useOrderManageStore
    store.getState().empty()
    fetchOrders.mockClear()
    await store.getState().fetch()
    expect(fetchOrders.mock.calls[0][0]).toEqual({ filter: [], pageSize: 10, current: 1 })
  })
})
