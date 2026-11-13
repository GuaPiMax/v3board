// 多个页面共用的列表查询（相当于原版 dva 里被多个页面 connect 的 model 数据）
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrap } from './request'
import { fetchConfig } from './services/config'
import { fetchPlans } from './services/plan'
import { fetchServerGroups } from './services/serverGroup'
import { fetchNodes } from './services/serverManage'
import { fetchServerRoutes } from './services/serverRoute'
import { useServerManageStore } from '@/stores/serverManage'

export const queryKeys = {
  serverGroups: ['server', 'group', 'list'],
  serverRoutes: ['server', 'route', 'list'],
  serverNodes: ['server', 'manage', 'nodes'],
  plans: ['plan', 'list'],
} as const

/**
 * 只读取缓存：组件挂载时不重新请求（原版节点编辑抽屉直接读 dva 里的列表，不会自己发请求）。
 * 缓存里还没有数据时仍会请求一次
 */
export const CACHED_ONLY = { refetchOnMount: false } as const

type QueryOptions = { refetchOnMount?: boolean }

/** 权限组列表（权限组、订阅、节点页面共用） */
export function useServerGroups(options?: QueryOptions) {
  return useQuery({ queryKey: queryKeys.serverGroups, queryFn: () => unwrap(fetchServerGroups()), ...options })
}

/** 路由列表（路由管理、节点编辑共用） */
export function useServerRoutes(options?: QueryOptions) {
  return useQuery({ queryKey: queryKeys.serverRoutes, queryFn: () => unwrap(fetchServerRoutes()), ...options })
}

/**
 * 全部节点（原版 serverManage/getNodes）。与原版一致：拉取成功后退出排序模式
 * （离开页面时未保存的排序模式与本地顺序会保留，回到页面重新拉取后才恢复）
 */
export function useServerNodes(options?: QueryOptions) {
  return useQuery({
    queryKey: queryKeys.serverNodes,
    queryFn: async () => {
      const nodes = await unwrap(fetchNodes())
      useServerManageStore.getState().setSortMode(false)
      return nodes
    },
    ...options,
  })
}

/** 订阅列表（订阅管理，以及优惠券、礼品卡、用户等页面的订阅选择） */
export function usePlans(options?: QueryOptions) {
  return useQuery({ queryKey: queryKeys.plans, queryFn: () => unwrap(fetchPlans()), ...options })
}

/**
 * 站点配置（config/fetch?key=site）。与原版一致，每次使用它的组件挂载时都重新读取
 * （布局里读取站点名称 / LOGO 的查询共用同一个 key，同时发出时会合并成一个请求）
 */
export function useSiteConfig() {
  return useQuery({ queryKey: ['config', 'site'], queryFn: () => unwrap(fetchConfig('site')) })
}

/**
 * 返回一个重新拉取指定列表的函数（返回的 Promise 在请求完成时结束）。
 * 原版 dva 的 put({ type: 'fetch' }) 不等待：操作成功后弹窗 / 抽屉立即关闭，列表在后台刷新，调用处用 void 即可
 */
export function useRefetch(key: readonly unknown[]) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: key })
}
