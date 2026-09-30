const configuredBaseUrl = import.meta.env.VITE_PUBLIC_BASE_URL?.trim()

if (!configuredBaseUrl) {
  throw new Error('A variável VITE_PUBLIC_BASE_URL não foi configurada.')
}

export const PUBLIC_API_BASE_URL = configuredBaseUrl.replace(/\/+$/, '')

export const API_BASE_URL =
  import.meta.env.DEV && !import.meta.env.SSR ? '/api' : PUBLIC_API_BASE_URL
