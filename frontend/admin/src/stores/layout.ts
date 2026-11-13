import { create } from 'zustand'

interface LayoutState {
  /** 移动端侧边栏是否展开 */
  showNav: boolean
  /** 不传参数时切换 */
  toggleNav: (show?: boolean) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  showNav: false,
  toggleNav: (show) => set((s) => ({ showNav: typeof show === 'boolean' ? show : !s.showNav })),
}))
