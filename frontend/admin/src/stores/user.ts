// 当前登录的管理员信息（顶栏显示邮箱）
import { create } from 'zustand'
import { fetchUserInfo } from '@/api/services/self'
import type { UserInfo } from '@/api/types'

interface UserState {
  userInfo: UserInfo | null
  loading: boolean
  loadUserInfo: () => Promise<void>
  clear: () => void
}

export const useUserStore = create<UserState>((set) => ({
  userInfo: null,
  loading: false,
  loadUserInfo: async () => {
    set({ loading: true })
    const res = await fetchUserInfo()
    set({ loading: false })
    if (res.code === 200 && res.data) set({ userInfo: res.data })
  },
  clear: () => set({ userInfo: null }),
}))
