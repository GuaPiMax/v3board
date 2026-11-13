import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { AdminUser, FilterCondition } from '../types'

type Filter = FilterCondition[]

/** 列表：参数为 { filter, ...pagination, ...sort }（与原版 model user 的顺序一致） */
export const fetchUsers = (params: object) => get<AdminUser[]>(adminPath('/user/fetch'), params)
export const getUserInfoById = (id: number) => get<AdminUser>(adminPath('/user/getUserInfoById'), { id })
/** 编辑：整条记录原样提交（流量单位为字节、金额单位为分） */
export const updateUser = (params: object) => post<boolean>(adminPath('/user/update'), params)
/** 创建 / 批量生成（带 generate_count 时后端直接返回 CSV，跨域失败由页面单独提示） */
export const generateUser = (params: { generate_count?: unknown }) =>
  post<boolean>(adminPath('/user/generate'), params, false, { silentNetworkError: Boolean(params.generate_count) })
/** 导出 CSV：后端直接输出文件内容（前后端分离部署时可能拿不到响应，由页面兜底） */
export const dumpUserCSV = (filter: Filter) =>
  post<never>(adminPath('/user/dumpCSV'), { filter }, false, { silentNetworkError: true })
export const sendMail = (params: object) => post<boolean>(adminPath('/user/sendMail'), params)
export const banUsers = (filter: Filter) => post<boolean>(adminPath('/user/ban'), { filter })
export const resetUserSecret = (id: number) => post<boolean>(adminPath('/user/resetSecret'), { id })
export const deleteUser = (id: number) => post<boolean>(adminPath('/user/delUser'), { id })
export const deleteUsers = (filter: Filter) => post<boolean>(adminPath('/user/allDel'), { filter })
