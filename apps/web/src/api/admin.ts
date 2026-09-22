import { clearAuthToken, getAuthHeaders } from '#/api/auth'

const REMOTE_API_BASE_URL = 'https://oda.vertb.com.br'

const DEFAULT_API_BASE_URL = import.meta.env.SSR
  ? REMOTE_API_BASE_URL
  : import.meta.env.DEV
    ? '/api'
    : REMOTE_API_BASE_URL

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL
).replace(/\/$/, '')

type AdminRecord = Record<string, unknown>

export type AdminJobProgress = {
  etapa?: string | null
  percentual?: number | null
  paginaAtual?: number | null
  paginasTotal?: number | null
  progressoEm?: string | null
}

export type AdminActiveJob = {
  fila: string
  jobId: string
  dgpId?: string | null
  lattesId?: string | null
  chave?: string | null
  nome?: string | null
  pipelineLogId?: string | null
  estado: string
  worker?: string | null
  tentativaAtual?: number | null
  tentativasMaximas?: number | null
  iniciadoEm?: string | null
  finalizadoEm?: string | null
  ultimoErro?: string | null
  progresso?: AdminJobProgress | null
}

type ActiveJobsResponse = {
  total: number
  jobs: AdminActiveJob[]
}

export type AdminQueue = {
  id: AdminQueueId
  label: string
  total: number
  jobs: AdminActiveJob[]
}
export type AdminQueueSnapshot = {
  workers: AdminRecord[]
  queues: AdminQueue[]
}

export type AdminQueueId =
  | 'dgp'
  | 'lattes'
  | 'discovery'
  | 'etl-groups'
  | 'etl-researchers'

export const adminQueueQueryKey = ['admin', 'queues'] as const

async function fetchAdminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...getAuthHeaders(),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearAuthToken()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('oda:auth-expired'))
      }
      throw new Error('Acesso administrativo não autorizado.')
    }
    throw new Error(
      `Erro ${response.status} ao carregar dados administrativos.`,
    )
  }

  return response.json() as Promise<T>
}

function getItems(response: unknown, keys: string[]): AdminRecord[] {
  if (Array.isArray(response)) {
    return response.filter(
      (item): item is AdminRecord => typeof item === 'object' && item !== null,
    )
  }
  if (!response || typeof response !== 'object') return []

  const record = response as AdminRecord
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key].filter(
        (item): item is AdminRecord =>
          typeof item === 'object' && item !== null,
      )
    }
  }
  return []
}

const ACTIVE_QUEUE_ENDPOINTS = [
  { id: 'dgp', label: 'Coleta DGP', path: '/admin/filas/dgp/jobs/ativos' },
  {
    id: 'lattes',
    label: 'Coleta Lattes',
    path: '/admin/filas/lattes/jobs/ativos',
  },
  {
    id: 'discovery',
    label: 'Descoberta DGP',
    path: '/admin/filas/discovery/jobs/ativos',
  },
  {
    id: 'etl-groups',
    label: 'ETL de grupos',
    path: '/admin/filas/etl/grupos/jobs/ativos',
  },
  {
    id: 'etl-researchers',
    label: 'ETL de pesquisadores',
    path: '/admin/filas/etl/pesquisadores/jobs/ativos',
  },
] as const

export async function getAdminQueueSnapshot(): Promise<AdminQueueSnapshot> {
  const [workersResponse, ...queueResponses] = await Promise.all([
    fetchAdminJson<unknown>('/admin/filas/workers'),
    ...ACTIVE_QUEUE_ENDPOINTS.map(({ path }) =>
      fetchAdminJson<ActiveJobsResponse>(path),
    ),
  ])

  return {
    workers: getItems(workersResponse, ['workers', 'data', 'items']),
    queues: ACTIVE_QUEUE_ENDPOINTS.map((queue, index) => ({
      id: queue.id,
      label: queue.label,
      total: queueResponses[index]?.total ?? 0,
      jobs: queueResponses[index]?.jobs ?? [],
    })),
  }
}

type EnqueueQueueConfig = {
  path: string
  identifierField: string
}

const ENQUEUE_QUEUE_CONFIG: Record<AdminQueueId, EnqueueQueueConfig> = {
  dgp: { path: '/admin/filas/dgp/jobs', identifierField: 'dgpId' },
  lattes: { path: '/admin/filas/lattes/jobs', identifierField: 'lattesId' },
  discovery: {
    path: '/admin/filas/discovery/jobs',
    identifierField: 'chave',
  },
  'etl-groups': {
    path: '/admin/filas/etl/grupos/jobs',
    identifierField: 'dgpId',
  },
  'etl-researchers': {
    path: '/admin/filas/etl/pesquisadores/jobs',
    identifierField: 'lattesId',
  },
}

export async function enqueueAdminJob(
  queueId: AdminQueueId,
  identifier?: string,
) {
  const config = ENQUEUE_QUEUE_CONFIG[queueId]
  const normalizedIdentifier = identifier?.trim()
  const body = normalizedIdentifier
    ? { [config.identifierField]: normalizedIdentifier }
    : {}

  return fetchAdminJson(config.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
