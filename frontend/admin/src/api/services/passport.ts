import { post } from '../request'
import type { LoginResult } from '../types'

export const login = (email: string, password: string) => post<LoginResult>('/passport/auth/login', { email, password })
