// 用户管理的列表与编辑状态（原版 dva model user，模块 hlQx）：与原版一样是全局状态，
// 页面、编辑抽屉、创建 / 群发邮件弹窗、订单详情里的「邮箱」跳转、工单详情都读写这里。
//   - 每个操作成功后重新拉取列表（不等待）；拉取参数为 { filter, ...pagination, ...sort }
//   - 从订单详情跳过来时先用 presetFilter 设置条件，由用户页挂载时拉取一次（原版追加条件时就拉取一次、跳过去后再拉取一次）
//   - 离开页面时重置（empty），每页条数取使用习惯 user_manage_page_size
import dayjs from 'dayjs'
import { create } from 'zustand'
import {
  banUsers,
  deleteUser,
  deleteUsers,
  dumpUserCSV,
  fetchUsers,
  generateUser,
  getUserInfoById,
  resetUserSecret,
  sendMail,
  updateUser,
} from '@/api/services/user'
import type { AdminUser, FilterCondition } from '@/api/types'
import { message } from '@/app/staticApi'
import { buildUserCsvFallback } from '@/pages/user/userCsv'
import { downloadBuffer, downloadText, handleGenerateResult } from '@/utils/download'
import { getHabit } from '@/utils/storage'

const GB = 1073741824

/** 表单里换算显示的字段（流量为 GB、金额为元，保留两位小数）与换算单位 */
const CONVERTED_FIELDS = [
  ['transfer_enable', GB],
  ['u', GB],
  ['d', GB],
  ['commission_balance', 100],
  ['balance', 100],
] as const

const shown = (value: unknown, unit: number) => (Number(value) / unit).toFixed(2)

export interface UserPagination {
  pageSize: number
  current: number
  total?: number
}

export interface UserSort {
  sort_type?: 'ASC' | 'DESC'
  sort?: string
}

/** 编辑抽屉里的用户：接口返回的整条记录（已换算单位），表单修改的字段直接写入 */
export type UserForm = Record<string, unknown> & { id?: number; email?: string; invite_user?: AdminUser }

interface UserManageState {
  users: AdminUser[]
  fetchLoading: boolean
  pagination: UserPagination
  sort: UserSort
  filter: FilterCondition[]
  /** 编辑抽屉里的用户（打开抽屉时按 id 读取，关闭时清空） */
  user: UserForm
  /** 编辑抽屉读取到的原始记录：保存时没有改动的换算字段按原值提交 */
  loadedUser: UserForm
  updateLoading: boolean
  generateLoading: boolean
  sendMailLoading: boolean
  setState: (state: Partial<UserManageState>) => void
  /** 离开页面时重置 */
  empty: () => void
  fetch: () => Promise<void>
  getUserInfoById: (id: number) => Promise<void>
  /** 过滤器抽屉「检索」：回到第 1 页 */
  filterBy: (filter: FilterCondition[]) => void
  changeTable: (pagination: Partial<UserPagination>, sort: UserSort) => void
  /** 追加一个过滤条件（clear 时先清空），回到第 1 页并拉取（「TA的邀请」） */
  addFilter: (key: string, condition: string, value: unknown, clear?: boolean) => void
  /** 跳到用户管理之前设置过滤条件并回到第 1 页（不拉取，用户页挂载时拉取；订单详情的邮箱、邀请人） */
  presetFilter: (filter: FilterCondition[]) => void
  update: (params: UserForm, callback?: () => void) => Promise<void>
  generate: (params: Record<string, unknown>, callback?: () => void) => Promise<void>
  dumpCSV: () => Promise<void>
  sendMail: (params: Record<string, unknown>, callback?: () => void) => Promise<void>
  ban: () => Promise<void>
  resetSecret: (id: number) => Promise<void>
  delUser: (id: number) => Promise<void>
  allDel: () => Promise<void>
}

const initialState = () => ({
  pagination: { pageSize: getHabit<number>('user_manage_page_size') || 10, current: 1 } as UserPagination,
  filter: [] as FilterCondition[],
  users: [] as AdminUser[],
  fetchLoading: false,
  user: {} as UserForm,
  loadedUser: {} as UserForm,
  sort: {} as UserSort,
  generateLoading: false,
  sendMailLoading: false,
  updateLoading: false,
})

/** 列表里的换算（原版 fetch：密码清空，流量换算成 GB、金额换算成元，保留两位小数） */
function toListUser(user: AdminUser): AdminUser {
  return {
    ...user,
    password: '',
    transfer_enable: (Number(user.transfer_enable) / GB).toFixed(2),
    u: (Number(user.u) / GB).toFixed(2),
    d: (Number(user.d) / GB).toFixed(2),
    total_used: (Number(user.total_used) / GB).toFixed(2),
    commission_balance: (Number(user.commission_balance) / 100).toFixed(2),
    balance: (Number(user.balance) / 100).toFixed(2),
  }
}

export const useUserManageStore = create<UserManageState>((set, get) => {
  /** 成功后重新拉取列表（与原版 put fetch 一样不等待） */
  const refetch = () => void get().fetch()

  return {
    ...initialState(),
    setState: (state) => set(state),
    empty: () => set(initialState()),

    fetch: async () => {
      const t = get()
      set({ fetchLoading: true })
      const res = await fetchUsers({ filter: t.filter, ...t.pagination, ...t.sort })
      set({ fetchLoading: false })
      if (res.code !== 200) return
      set({ users: (res.data ?? []).map(toListUser), pagination: { ...t.pagination, total: res.total } })
    },

    getUserInfoById: async (id) => {
      const res = await getUserInfoById(id)
      if (res.code !== 200 || !res.data) return
      const data: UserForm = { ...res.data }
      data.password = ''
      for (const [key, unit] of CONVERTED_FIELDS) data[key] = shown(data[key], unit)
      if (data.invite_user) data.invite_user_email = data.invite_user.email
      set({ user: data, loadedUser: res.data })
    },

    filterBy: (filter) => {
      set({ pagination: { ...get().pagination, current: 1 }, filter })
      refetch()
    },

    changeTable: (pagination, sort) => {
      set({ pagination: { ...get().pagination, ...pagination }, sort })
      refetch()
    },

    addFilter: (key, condition, value, clear = false) => {
      const t = get()
      set({ filter: [...(clear ? [] : t.filter), { key, condition, value }], pagination: { ...t.pagination, current: 1 } })
      refetch()
    },

    presetFilter: (filter) => set({ filter, pagination: { ...get().pagination, current: 1 } }),

    update: async (params, callback) => {
      set({ updateLoading: true })
      // 流量、金额：没有改动的提交读取时的原值，改动过的按显示单位换算后取整。原版一律按显示值换算
      // （流量还不取整），例如 1000000000 字节显示为 0.93GB，原样保存后变成 998579896 字节，有意修正
      const loaded = get().loadedUser
      for (const [key, unit] of CONVERTED_FIELDS) {
        const unchanged = loaded.id === params.id && params[key] === shown(loaded[key], unit)
        params[key] = unchanged ? Number(loaded[key]) : Math.round(unit * Number(params[key]))
      }
      if (params.invite_user) delete params.invite_user
      const res = await updateUser(params)
      set({ updateLoading: false })
      if (res.code !== 200) return
      refetch()
      callback?.()
    },

    generate: async (params, callback) => {
      set({ generateLoading: true })
      const res = await generateUser(params)
      set({ generateLoading: false })
      if (!handleGenerateResult(res, { batch: Boolean(params.generate_count), prefix: 'USER', noun: '用户' })) return
      refetch()
      callback?.()
    },

    dumpCSV: async () => {
      const { filter } = get()
      message.loading('导出中')
      const res = await dumpUserCSV(filter)
      if (res.networkError) {
        // 前后端分离部署时 CSV 较大（超过后端 PHP output_buffering）会拿不到响应：改为分页读取列表，按后端相同的格式生成
        const csv = await buildUserCsvFallback(filter)
        message.destroy()
        if (csv !== undefined) downloadText(csv, `${dayjs().format('YYYY-MM-DD HH:mm:ss')}.csv`)
        return
      }
      message.destroy()
      if (res.code !== 200) return
      downloadBuffer(res.buffer, `${dayjs().format('YYYY-MM-DD HH:mm:ss')}.csv`)
    },

    sendMail: async (params, callback) => {
      const { filter } = get()
      set({ sendMailLoading: true })
      const res = await sendMail({ filter, ...params })
      set({ sendMailLoading: false })
      if (res.code !== 200) return
      message.success('已加入队列执行')
      callback?.()
    },

    ban: async () => {
      const res = await banUsers(get().filter)
      if (res.code !== 200) return
      refetch()
    },

    resetSecret: async (id) => {
      const res = await resetUserSecret(id)
      if (res.code !== 200) return
      message.success('重置成功')
      refetch()
    },

    delUser: async (id) => {
      const res = await deleteUser(id)
      if (res.code !== 200) return
      message.success('删除成功')
      refetch()
    },

    allDel: async () => {
      const res = await deleteUsers(get().filter)
      if (res.code !== 200) return
      refetch()
    },
  }
})
