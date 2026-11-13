// 列表的分页 / 排序参数：与原版 dva model 一样在页面切换后保留（例如翻到第 2 页，离开再回来仍是第 2 页）
import { create } from 'zustand'
import type { PageParams } from '@/api/types'

export type ListParams = PageParams

interface ListParamsState {
  lists: Record<string, ListParams>
  set: (key: string, params: Partial<ListParams>) => void
}

export const DEFAULT_LIST_PARAMS: ListParams = { pageSize: 10, current: 1 }

export const useListParamsStore = create<ListParamsState>((set) => ({
  lists: {},
  set: (key, params) => set((s) => ({ lists: { ...s.lists, [key]: { ...(s.lists[key] ?? DEFAULT_LIST_PARAMS), ...params } } })),
}))

export function useListParams(key: string, initial: ListParams = DEFAULT_LIST_PARAMS) {
  const params = useListParamsStore((s) => s.lists[key]) ?? initial
  const setParams = (next: Partial<ListParams>) => useListParamsStore.getState().set(key, next)
  return [params, setParams] as const
}
