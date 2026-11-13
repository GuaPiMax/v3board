import { useQuery } from '@tanstack/react-query'
import { adminPath } from '@/app/settings'
import { ApiError, get, post } from '../request'

export interface ExternalSubscription {
  id: number
  name: string
  node_prefix: string
  filter_keywords: string[]
  enabled: number | boolean
  revision: number
  synced_at: number | null
  attempted_at: number | null
  status: string | null
  node_count: number
  plan_ids: number[]
}

export const externalKey = ['external-subscriptions'] as const
export function useExternalSubscriptions(enabled = true) {
  return useQuery({
    queryKey: externalKey,
    enabled,
    queryFn: async () => {
      const res = await get<ExternalSubscription[]>(adminPath('/external-subscription/fetch'))
      if (res.code !== 200) throw new ApiError(res.code, res.msg)
      return { sources: res.data ?? [], plans: res.plans as Array<{ id: number; name: string }> }
    },
  })
}

export type SourceForm = Pick<ExternalSubscription, 'name' | 'plan_ids'> & {
  node_prefix?: string
  filter_keywords?: string[]
  id?: number
  revision?: number
  enabled: boolean
  url: string
}
export const saveExternalSubscription = (data: SourceForm) => post(adminPath('/external-subscription/save'), data, true)
export const dropExternalSubscription = (id: number) => post(adminPath('/external-subscription/drop'), { id })
export const syncExternalSubscription = (id: number) => post<boolean>(adminPath('/external-subscription/sync'), { id })
