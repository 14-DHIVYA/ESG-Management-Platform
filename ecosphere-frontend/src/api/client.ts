import axios from 'axios'

export type ApiEnvelope<T = unknown> = {
  success: boolean
  data?: T
  report?: string
  module?: string
  pagination?: { page: number; limit: number; total: number }
  flaggedCount?: number
  badgesAwarded?: Array<Record<string, unknown>>
  message?: string
  details?: Array<{ field: string; message: string }>
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ecosphere_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('ecosphere_token')
      localStorage.removeItem('ecosphere_user')
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export function dataOf<T>(payload: ApiEnvelope<T>): T {
  return (payload.data ?? []) as T
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function fieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) return {}
  const details = error.response?.data?.details
  if (!Array.isArray(details)) return {}
  return details.reduce<Record<string, string>>((acc, item) => {
    if (item?.field) acc[item.field] = item.message
    return acc
  }, {})
}
