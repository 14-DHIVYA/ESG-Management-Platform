import { createContext } from 'react'

export type User = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR'
  department_id?: string | null
  xp_points?: number
  points_balance?: number
}

export type AuthContextValue = {
  user: User | null
  loading: boolean
  isManager: boolean
  isAdmin: boolean
  isAuditor: boolean
  setSession: (token: string, user: User) => void
  refreshUser: () => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
