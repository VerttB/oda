import { getApiUrls } from './base-url'

const publicUrls = getApiUrls(import.meta.env.VITE_PUBLIC_BASE_URL ?? '')
const clientUrls =
  import.meta.env.DEV && !import.meta.env.SSR ? getApiUrls('/api') : publicUrls

export const PUBLIC_API_BASE_URL = publicUrls.apiUrl
export const API_BASE_URL = clientUrls.apiUrl
export const API_ASSET_BASE_URL = clientUrls.rootUrl
