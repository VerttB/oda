import { API_BASE_URL } from '#/api/config'
import type { LoginRequest, LoginResponse } from '@oda/shared-types'

const AUTH_TOKEN_KEY = 'oda.admin.access-token'

export async function login(credentials: LoginRequest) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'Usuário ou senha inválidos.'
        : 'Não foi possível entrar. Tente novamente.',
    )
  }

  const result = (await response.json()) as LoginResponse
  setAuthToken(result.access_token)
  return result
}

export function getAuthToken() {
  if (typeof window === 'undefined') return null
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined')
    window.sessionStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  if (typeof window !== 'undefined')
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
