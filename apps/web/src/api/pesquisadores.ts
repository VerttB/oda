import type { ResearcherItem } from '#/core/interfaces'

const REMOTE_API_BASE_URL = 'https://oda.vertb.com.br'

const DEFAULT_API_BASE_URL = import.meta.env.SSR
  ? REMOTE_API_BASE_URL
  : import.meta.env.DEV
    ? '/api'
    : REMOTE_API_BASE_URL

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL
).replace(/\/$/, '')

export type ResearcherDegreeFilter =
  | 'GRADUACAO'
  | 'ESPECIALIZACAO'
  | 'MESTRADO'
  | 'DOUTORADO'
  | 'OUTRO'

export type ResearcherTypeFilter =
  | 'TECNICO'
  | 'ESTUDANTE'
  | 'PESQUISADOR'
  | 'COLABORADOR_ESTRANGEIRO'

export type ResearchersFilters = {
  page?: number
  size?: number
  nome?: string
  formacaoAcademica?: ResearcherDegreeFilter
  tipo?: ResearcherTypeFilter
}

export const researchersQueryKey = (filters: ResearchersFilters = {}) => [
  'researchers',
  filters,
]

export const researchersMetricsQueryKey = ['researchers-metrics']

type ApiPesquisador = {
  id: string
  lattesId?: string | null
  nome?: string | null
  tipo?: ResearcherTypeFilter | string | null
  formacaoAcademica?: ResearcherDegreeFilter | string | null
  openAlexId?: string | null
  orcidId?: string | null
  imageUrl?: string | null
  indexH?: number | null
  indexI10?: number | null
}

type ApiPaginatedPesquisadores = {
  data?: ApiPesquisador[]
  items?: ApiPesquisador[]
  results?: ApiPesquisador[]
  meta?: {
    page?: number
    size?: number
    totalItems?: number
    totalPages?: number
  }
}

type ApiPesquisadoresMetricas = {
  totalPesquisadores: number
  totalComOrcid: number
  porFormacao: {
    formacao: string
    total: number
  }[]
  porTipo: {
    tipo: string
    total: number
  }[]
}

export type ResearchersPage = {
  data: ResearcherItem[]
  meta: {
    page: number
    size: number
    totalItems: number
    totalPages: number
  }
}

export type ResearchersMetrics = {
  totalResearchers: number
  totalWithOrcid: number
  byDegree: {
    degree: string
    label: string
    count: number
  }[]
  byType: {
    type: string
    label: string
    count: number
  }[]
}

function normalizeApiAssetUrl(url?: string | null) {
  if (!url) {
    return undefined
  }

  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`
  }

  return url
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function getDegreeLabel(value?: string | null) {
  switch (value) {
    case 'GRADUACAO':
      return 'Graduação'
    case 'ESPECIALIZACAO':
      return 'Especialização'
    case 'MESTRADO':
      return 'Mestrado'
    case 'DOUTORADO':
      return 'Doutorado'
    case 'OUTRO':
      return 'Outro'
    default:
      return 'Não informada'
  }
}

function getResearcherTypeLabel(value?: string | null) {
  switch (value) {
    case 'TECNICO':
      return 'Técnico'
    case 'ESTUDANTE':
      return 'Estudante'
    case 'PESQUISADOR':
      return 'Pesquisador'
    case 'COLABORADOR_ESTRANGEIRO':
      return 'Colaborador estrangeiro'
    default:
      return 'Pesquisador'
  }
}

function getResearchersFromResponse(
  response: ApiPesquisador[] | ApiPaginatedPesquisadores,
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

function mapResearcher(researcher: ApiPesquisador): ResearcherItem {
  const name = researcher.nome ?? 'Pesquisador sem nome'
  const avatar = normalizeApiAssetUrl(researcher.imageUrl)

  return {
    id: researcher.id,
    name,
    institution: 'Instituição não informada',
    degree: getDegreeLabel(researcher.formacaoAcademica),
    title: getResearcherTypeLabel(researcher.tipo),
    isActive: true,
    avatar,
    avatarUrl: avatar,
    initials: getInitials(name),
    citationsCount: 0,
    hIndex: researcher.indexH ?? 0,
    productionsCount: researcher.indexI10 ?? 0,
    lattesId: researcher.lattesId ?? '',
    primaryArea: 'Área não informada',
    field: getDegreeLabel(researcher.formacaoAcademica),
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao carregar dados da API`)
  }

  return response.json() as Promise<T>
}

function buildResearchersSearchParams(filters: ResearchersFilters) {
  const params = new URLSearchParams()

  if (filters.page) {
    params.set('page', String(filters.page))
  }

  if (filters.size) {
    params.set('size', String(filters.size))
  }

  if (filters.nome?.trim()) {
    params.set('nome', filters.nome.trim())
  }

  if (filters.formacaoAcademica) {
    params.set('formacaoAcademica', filters.formacaoAcademica)
  }

  if (filters.tipo) {
    params.set('tipo', filters.tipo)
  }

  return params
}

export async function getResearchers(
  filters: ResearchersFilters = {},
): Promise<ResearchersPage> {
  const params = buildResearchersSearchParams(filters)
  const query = params.toString()
  const response = await fetchJson<
    ApiPesquisador[] | ApiPaginatedPesquisadores
  >(`/pesquisadores${query ? `?${query}` : ''}`)
  const page = getResearchersFromResponse(response)

  return {
    data: page.data.map(mapResearcher),
    meta: page.meta,
  }
}

export async function getResearchersMetrics(): Promise<ResearchersMetrics> {
  const metrics = await fetchJson<ApiPesquisadoresMetricas>(
    '/metricas/pesquisadores',
  )

  return {
    totalResearchers: metrics.totalPesquisadores,
    totalWithOrcid: metrics.totalComOrcid,
    byDegree: metrics.porFormacao.map((item) => ({
      degree: item.formacao,
      label: getDegreeLabel(item.formacao),
      count: item.total,
    })),
    byType: metrics.porTipo.map((item) => ({
      type: item.tipo,
      label: getResearcherTypeLabel(item.tipo),
      count: item.total,
    })),
  }
}
