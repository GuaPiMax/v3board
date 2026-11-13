import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const saveConfig = vi.fn(async (_params: object) => ({ code: 200 }))
const fetchConfig = vi.fn(async (_key?: string) => ({
  code: 200,
  data: {
    site: { app_name: 'V2Board', currency: 'CNY' },
    safe: { email_verify: 0 },
    invite: { commission_withdraw_method: '支付宝,USDT' },
    deposit: { deposit_bounus: '50:18,100:38' },
  },
}))
const setTelegramWebhook = vi.fn(async (_token: string) => ({ code: 200 }))
const success = vi.fn()
vi.mock('../src/api/services/config', () => ({ saveConfig, fetchConfig, setTelegramWebhook }))
vi.mock('../src/app/staticApi', () => ({ message: { success }, modal: {} }))

const { SAVE_DELAY, useConfigManageStore } = await import('../src/stores/configManage')
const store = () => useConfigManageStore.getState()

describe('系统配置：修改后按分组自动保存', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    await store().fetch()
    saveConfig.mockClear()
    fetchConfig.mockClear()
    success.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('读取时把逗号分隔的提现方式、充值奖励拆成数组', () => {
    expect(store().invite.commission_withdraw_method).toEqual(['支付宝', 'USDT'])
    expect(store().deposit.deposit_bounus).toEqual(['50:18', '100:38'])
  })

  it('同一分组连续修改只保存一次，提交该分组的全部字段', async () => {
    store().setValue('site', 'app_name', 'A')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY - 100)
    store().setValue('site', 'app_name', 'AB')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY - 100)
    expect(saveConfig).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(saveConfig).toHaveBeenCalledTimes(1)
    expect(saveConfig).toHaveBeenCalledWith({ app_name: 'AB', currency: 'CNY' })
    // 保存成功：提示并重新读取
    expect(success).toHaveBeenCalledWith('保存成功')
    expect(fetchConfig).toHaveBeenCalledTimes(1)
  })

  it('有意修正：1.5 秒内改了另一个分组，两个分组都会保存（原版只保存后一个）', async () => {
    store().setValue('site', 'currency', 'USD')
    await vi.advanceTimersByTimeAsync(500)
    store().setValue('safe', 'email_verify', 1)
    await vi.advanceTimersByTimeAsync(SAVE_DELAY)
    expect(saveConfig).toHaveBeenCalledTimes(2)
    expect(saveConfig).toHaveBeenNthCalledWith(1, { app_name: 'V2Board', currency: 'USD' })
    expect(saveConfig).toHaveBeenNthCalledWith(2, { email_verify: 1 })
  })

  it('前一个分组保存后的重新读取不会覆盖后一个分组还没保存的修改', async () => {
    store().setValue('site', 'currency', 'USD')
    await vi.advanceTimersByTimeAsync(500)
    store().setValue('safe', 'email_verify', 1)
    // 站点分组保存并重新读取（读回的 safe 仍是后端的旧值 0）
    await vi.advanceTimersByTimeAsync(SAVE_DELAY - 500)
    expect(fetchConfig).toHaveBeenCalledTimes(1)
    expect(store().safe.email_verify).toBe(1)
    // 安全分组保存后再读取，才使用读回的值
    await vi.advanceTimersByTimeAsync(500)
    expect(saveConfig).toHaveBeenLastCalledWith({ email_verify: 1 })
    expect(fetchConfig).toHaveBeenCalledTimes(2)
    expect(store().safe.email_verify).toBe(0)
  })

  it('保存失败时不提示、不重新读取', async () => {
    saveConfig.mockResolvedValueOnce({ code: 422 })
    store().setValue('site', 'currency', 'USD')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY)
    expect(saveConfig).toHaveBeenCalledTimes(1)
    expect(success).not.toHaveBeenCalled()
    expect(fetchConfig).not.toHaveBeenCalled()
  })

  it('有意修正：「一键设置」先保存还没保存的 Token，再带上 Token 请求', async () => {
    store().setValue('telegram', 'telegram_bot_token', '123:new')
    const done = store().setTelegramWebhook()
    await vi.advanceTimersByTimeAsync(0)
    await done
    expect(saveConfig).toHaveBeenCalledWith({ telegram_bot_token: '123:new' })
    expect(setTelegramWebhook).toHaveBeenCalledWith('123:new')
    expect(saveConfig.mock.invocationCallOrder[0]).toBeLessThan(setTelegramWebhook.mock.invocationCallOrder[0])
    // 自动保存的定时器已经取消，不会再保存一次
    await vi.advanceTimersByTimeAsync(SAVE_DELAY)
    expect(saveConfig).toHaveBeenCalledTimes(1)
  })

  it('Token 保存失败时不设置 Webhook', async () => {
    setTelegramWebhook.mockClear()
    saveConfig.mockResolvedValueOnce({ code: 422 })
    store().setValue('telegram', 'telegram_bot_token', 'bad')
    await store().setTelegramWebhook()
    expect(setTelegramWebhook).not.toHaveBeenCalled()
    expect(store().setTelegramWebhookLoading).toBe(false)
  })
})
