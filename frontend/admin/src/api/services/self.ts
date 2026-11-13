// 当前登录用户（用户侧接口，管理员 token 同样可用）
import { get } from '../request'
import type { CheckLoginResult, UserInfo } from '../types'

export const checkLogin = () => get<CheckLoginResult>('/user/checkLogin')
export const fetchUserInfo = () => get<UserInfo>('/user/info')
