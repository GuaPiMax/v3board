// 节点管理的排序模式：与原版 dva model serverManage 一样是全局状态，离开页面不会重置，节点列表拉取成功后才退出
import { create } from 'zustand'

interface ServerManageState {
  sortMode: boolean
  /** 正在保存排序（与拉取列表共用页面的加载状态） */
  savingSort: boolean
  setSortMode: (sortMode: boolean) => void
  setSavingSort: (savingSort: boolean) => void
}

export const useServerManageStore = create<ServerManageState>((set) => ({
  sortMode: false,
  savingSort: false,
  setSortMode: (sortMode) => set({ sortMode }),
  setSavingSort: (savingSort) => set({ savingSort }),
}))
