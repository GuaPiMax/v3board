import { adminPath } from '@/app/settings'
import { get, post } from '../request'
import type { Knowledge } from '../types'

export const fetchKnowledges = () => get<Knowledge[]>(adminPath('/knowledge/fetch'))
export const fetchKnowledge = (id: number) => get<Knowledge>(adminPath('/knowledge/fetch'), { id })
/** 原版页面加载时会请求分类列表（界面上没有用到） */
export const fetchKnowledgeCategories = () => get<string[]>(adminPath('/knowledge/getCategory'))
/** 与原版一致：编辑时把整条记录原样提交 */
export const saveKnowledge = (params: Partial<Knowledge>) => post<boolean>(adminPath('/knowledge/save'), params)
export const dropKnowledge = (id: number) => post<boolean>(adminPath('/knowledge/drop'), { id })
export const toggleKnowledgeShow = (id: number) => post<boolean>(adminPath('/knowledge/show'), { id })
export const sortKnowledges = (ids: number[]) => post<boolean>(adminPath('/knowledge/sort'), { knowledge_ids: ids })
