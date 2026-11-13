import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Notice } from '../types'

export const fetchNotices = () => get<Notice[]>(adminPath('/notice/fetch'))
/** 与原版一致：编辑时把整条记录原样提交（id、created_at 等由后端忽略） */
export const saveNotice = (params: Partial<Notice>) => post<boolean>(adminPath('/notice/save'), params)
export const dropNotice = (id: number) => post<boolean>(adminPath('/notice/drop'), { id })
export const toggleNoticeShow = (id: number) => post<boolean>(adminPath('/notice/show'), { id })
