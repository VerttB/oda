/** A variável pode apontar para a raiz pública ou já terminar em /v1. */
export function getApiUrls(configuredBaseUrl: string) {
  const rootUrl = configuredBaseUrl
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '')
  if (!rootUrl) {
    throw new Error('A variável VITE_PUBLIC_BASE_URL não foi configurada.')
  }
  return { rootUrl, apiUrl: `${rootUrl}/v1` }
}
