import { describe, expect, it, vi } from 'vitest'

const payments = [
  { id: 1, name: '支付宝' },
  { id: 2, name: '微信支付' },
]
const fetchPayments = vi.fn(async () => ({ code: 200, data: payments }))
const sortPayments = vi.fn(async (_ids: number[]) => ({ code: 500 }))
vi.mock('../src/api/services/payment', () => ({ fetchPayments, sortPayments }))

const { usePaymentManageStore } = await import('../src/stores/paymentManage')
const store = () => usePaymentManageStore.getState()

describe('支付配置：拖动排序', () => {
  it('有意修正：提交失败时重新拉取，恢复后端的顺序并结束加载（原版一直显示加载中）', async () => {
    await store().fetch()
    fetchPayments.mockClear()
    await store().sort(0, 1)
    expect(sortPayments).toHaveBeenCalledWith([2, 1])
    await vi.waitFor(() => expect(store().fetchLoading).toBe(false))
    expect(fetchPayments).toHaveBeenCalledTimes(1)
    expect(store().payments.map((p) => p.id)).toEqual([1, 2])
  })
})
