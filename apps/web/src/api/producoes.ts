import type { ProductionItem } from '#/core/interfaces'

const REMOTE_API_BASE_URL = 'https://oda.vertb.com.br'

const DEFAULT_API_BASE_URL = import.meta.env.SSR
  ? REMOTE_API_BASE_URL
  : import.meta.env.DEV
    ? '/api'
    : REMOTE_API_BASE_URL

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL
).replace(/\/$/, '')

export type ProductionTypeFilter = 'ARTIGO' | 'LIVROCAPITULO' | 'OUTRA'

export type ProductionsFilters = {
  page?: number
  size?: number
  titulo?: string
  ano?: number
  tipo?: ProductionTypeFilter
}

export const productionsQueryKey = (filters: ProductionsFilters = {}) => [
  'productions',
  filters,
]

type ApiProducao = {
  id: string
  titulo?: string | null
  ano?: number | null
  tipo?: ProductionTypeFilter | string | null
  doi?: string | null
  url?: string | null
  veiculo?: string | null
  qualis?: string | null
  resumo?: string | null
}

type ApiPaginatedProducoes = {
  data?: ApiProducao[]
  items?: ApiProducao[]
  results?: ApiProducao[]
  meta?: {
    page?: number
    size?: number
    totalItems?: number
    totalPages?: number
  }
}

export type ProductionsPage = {
  data: ProductionItem[]
  meta: {
    page: number
    size: number
    totalItems: number
    totalPages: number
  }
}

function getProductionsFromResponse(
  response: ApiProducao[] | ApiPaginatedProducoes,
) {
  if (Array.isArray(response)) {
    return {
      data: response,
      meta: {
        page: 1,
        size: response.length,
        totalItems: response.length,
        totalPages: 1,
      },
    }
  }

  const data = response.data ?? response.items ?? response.results ?? []

  return {
    data,
    meta: {
      page: response.meta?.page ?? 1,
      size: response.meta?.size ?? data.length,
      totalItems: response.meta?.totalItems ?? data.length,
      totalPages: response.meta?.totalPages ?? 1,
    },
  }
}

function getProductionTypeLabel(type?: string | null) {
  switch (type) {
    case 'ARTIGO':
      return 'Artigo'
    case 'LIVROCAPITULO':
      return 'Capítulo de livro'
    case 'OUTRA':
      return 'Outra produção'
    default:
      return 'Produção'
  }
}

function mapProduction(production: ApiProducao): ProductionItem {
  return {
    id: production.id,
    title: production.titulo ?? 'Produção sem título',
    authors: 'Autoria não informada',
    venue: production.veiculo ?? undefined,
    journalOrConference: production.veiculo ?? undefined,
    year: production.ano ?? 'Ano não informado',
    qualis: production.qualis ?? undefined,
    type: getProductionTypeLabel(production.tipo),
    openAccess: Boolean(production.url),
    isOpenAccess: Boolean(production.url),
    citations: 0,
    doi: production.doi ?? undefined,
    url: production.url ?? undefined,
    abstract: production.resumo ?? undefined,
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao carregar dados da API`)
  }

  return response.json() as Promise<T>
}

function buildProductionsSearchParams(filters: ProductionsFilters) {
  const params = new URLSearchParams()

  if (filters.page) {
    params.set('page', String(filters.page))
  }

  if (filters.size) {
    params.set('size', String(filters.size))
  }

  if (filters.titulo?.trim()) {
    params.set('titulo', filters.titulo.trim())
  }

  if (filters.ano) {
    params.set('ano', String(filters.ano))
  }

  if (filters.tipo) {
    params.set('tipo', filters.tipo)
  }

  return params
}

export async function getProductions(
  filters: ProductionsFilters = {},
): Promise<ProductionsPage> {
  const params = buildProductionsSearchParams(filters)
  const query = params.toString()
  const response = await fetchJson<ApiProducao[] | ApiPaginatedProducoes>(
    `/producoes${query ? `?${query}` : ''}`,
  )
  const page = getProductionsFromResponse(response)

  return {
    data: page.data.map(mapProduction),
    meta: page.meta,
  }
}
