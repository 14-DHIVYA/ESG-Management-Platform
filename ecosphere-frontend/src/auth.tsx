import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, dataOf, type ApiEnvelope } from './api/client'
import { AuthContext, type AuthContextValue, type User } from './auth-context'

function savedUser(): User | null {
  const raw = localStorage.getItem('ecosphere_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(savedUser)
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('ecosphere_token')))

  const refreshUser = async () => {
    const response = await api.get<ApiEnvelope<User>>('/auth/me')
    const nextUser = dataOf<User>(response.data)
    setUser(nextUser)
    localStorage.setItem('ecosphere_user', JSON.stringify(nextUser))
  }

  useEffect(() => {
    if (!localStorage.getItem('ecosphere_token')) {
      setLoading(false)
      return
    }
    refreshUser().catch(() => undefined).finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isManager: user?.role === 'ADMIN' || user?.role === 'MANAGER',
    isAdmin: user?.role === 'ADMIN',
    isAuditor: user?.role === 'ADMIN' || user?.role === 'AUDITOR',
    setSession: (token, nextUser) => {
      localStorage.setItem('ecosphere_token', token)
      localStorage.setItem('ecosphere_user', JSON.stringify(nextUser))
      setUser(nextUser)
    },
    refreshUser,
    logout: () => {
      localStorage.removeItem('ecosphere_token')
      localStorage.removeItem('ecosphere_user')
      setUser(null)
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export type { User } from './auth-context'
