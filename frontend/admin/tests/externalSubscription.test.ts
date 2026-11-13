import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../src/app/settings', () => ({
  apiBase: 'http://api.test/api/v1',
  adminPath: (path: string) => '/admin-test' + path,
}))
vi.mock('../src/app/staticApi', () => ({ notification: { error: vi.fn() } }))
vi.stubGlobal('window', {
  localStorage: { getItem: () => 'existing-admin-token', removeItem: vi.fn() },
  location: { origin: 'http://admin.test', pathname: '/admin-test' },
})
const { saveExternalSubscription } = await import('../src/api/services/externalSubscription')
const { savePlan } = await import('../src/api/services/plan')
let fetchMock = vi.fn()
beforeEach(() => {
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ data: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

it('source save reuses admin authorization and preserves an empty binding array and blank retained URL', async () => {
  await saveExternalSubscription({
    id: 3,
    revision: 2,
    name: 'Example',
    node_prefix: '备用 ',
    filter_keywords: ['香港', 'Test'],
    url: '',
    enabled: false,
    plan_ids: [],
  })
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('http://api.test/api/v1/admin-test/external-subscription/save')
  expect(new Headers(init.headers).get('authorization')).toBe('existing-admin-token')
  expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  expect(JSON.parse(init.body as string)).toEqual({
    id: 3,
    revision: 2,
    name: 'Example',
    node_prefix: '备用 ',
    filter_keywords: ['香港', 'Test'],
    url: '',
    enabled: false,
    plan_ids: [],
  })
})

it('plan save sends an explicit empty selection and conflict token while preserving prices in cents', async () => {
  await savePlan({
    id: 4,
    month_price: 1234,
    external_subscription_ids: [],
    external_binding_token: 'binding-fingerprint',
  })
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('http://api.test/api/v1/admin-test/plan/save')
  expect(JSON.parse(init.body as string)).toEqual({
    id: 4,
    month_price: 1234,
    external_subscription_ids: [],
    external_binding_token: 'binding-fingerprint',
  })
})
