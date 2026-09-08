import type {
  AcademicAuthor,
  AcademicProductionDetailData,
  ProductionItem,
} from '#/core/interfaces'

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

export const productionDetailQueryKey = (producaoId: string) => [
  'production',
  producaoId,
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
  issn?: string | null
  paginas?: string | null
  pages?: string | null
  qualisArea?: string | null
  citacoes?: number | null
  citations?: number | null
  grupo?: {
    nome?: string | null
  } | null
  grupoPesquisa?: {
    nome?: string | null
  } | null
  instituicao?: {
    nome?: string | null
    sigla?: string | null
  } | null
  autores?: ApiProducaoAutor[] | null
  palavrasChave?: ApiPalavraChave[] | null
}

type ApiProducaoAutor = {
  pesquisadorId?: string | null
  nome?: string | null
  ordemAutoria?: number | null
  pesquisador?: {
    id?: string | null
    nome?: string | null
    tipo?: string | null
    instituicao?: {
      nome?: string | null
      sigla?: string | null
    } | null
  } | null
}

type ApiPalavraChave = {
  nome?: string | null
  palavra?: string | null
  termo?: string | null
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
  const authors = production.autores
    ?.map(mapProductionAuthor)
    .map((author) => author.name)
    .filter(Boolean)

  return {
    id: production.id,
    title: production.titulo ?? 'Produção sem título',
    authors: authors && authors.length > 0 ? authors : 'Autoria não informada',
    venue: production.veiculo ?? undefined,
    journalOrConference: production.veiculo ?? undefined,
    year: production.ano ?? 'Ano não informado',
    qualis: production.qualis ?? undefined,
    type: getProductionTypeLabel(production.tipo),
    openAccess: Boolean(production.url),
    isOpenAccess: Boolean(production.url),
    citations: production.citations ?? production.citacoes ?? 0,
    doi: production.doi ?? undefined,
    url: production.url ?? undefined,
    abstract: production.resumo ?? undefined,
    groupName:
      production.grupoPesquisa?.nome ?? production.grupo?.nome ?? undefined,
    institution:
      production.instituicao?.sigla ??
      production.instituicao?.nome ??
      undefined,
    keywords: production.palavrasChave?.map(getKeywordLabel).filter(Boolean),
    issn: production.issn ?? undefined,
    pages: production.pages ?? production.paginas ?? undefined,
    qualisArea: production.qualisArea ?? undefined,
  }
}

function getKeywordLabel(keyword: ApiPalavraChave) {
  return keyword.nome ?? keyword.palavra ?? keyword.termo ?? ''
}

function mapProductionAuthor(author: ApiProducaoAutor): AcademicAuthor {
  const researcher = author.pesquisador
  const name = researcher?.nome ?? author.nome ?? 'Autor não informado'
  const institution =
    researcher?.instituicao?.sigla ?? researcher?.instituicao?.nome ?? undefined

  return {
    id: researcher?.id ?? author.pesquisadorId ?? undefined,
    name,
    institution,
    isExternal: researcher?.tipo === 'COLABORADOR_ESTRANGEIRO',
  }
}

function parseProductionAuthors(production: ProductionItem): AcademicAuthor[] {
  if (Array.isArray(production.authors)) {
    return production.authors.map((author) => ({
      name: author,
      isExternal: author.toLowerCase().includes('externo'),
    }))
  }

  return production.authors
    .split(';')
    .flatMap((chunk) => chunk.split('&'))
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      isExternal: name.toLowerCase().includes('externo'),
    }))
}

function mapProductionDetail(
  production: ApiProducao,
): AcademicProductionDetailData {
  const listItem = mapProduction(production)
  const authors =
    production.autores?.map(mapProductionAuthor).filter(Boolean) ??
    parseProductionAuthors(listItem)

  return {
    ...listItem,
    authors: authors.length > 0 ? authors : [{ name: 'Autoria não informada' }],
    abstract: listItem.abstract ?? 'Resumo não informado.',
    citations: listItem.citations ?? 0,
    doi: listItem.doi ?? '',
    groupName: listItem.groupName ?? 'Grupo não informado',
    institution: listItem.institution ?? 'Instituição não informada',
    issn: listItem.issn ?? 'Não informado',
    journal: listItem.journalOrConference ?? listItem.venue ?? 'Não informado',
    keywords:
      listItem.keywords && listItem.keywords.length > 0
        ? listItem.keywords
        : [listItem.type, 'Produção acadêmica'].filter(Boolean),
    pages: listItem.pages ?? 'Não informado',
    qualis: listItem.qualis ?? 'Não informado',
    qualisArea: listItem.qualisArea ?? 'Área Qualis não informada',
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

export async function getProductionDetail(
  producaoId: string,
): Promise<AcademicProductionDetailData> {
  const response = await fetchJson<ApiProducao>(`/producoes/${producaoId}`)

  return mapProductionDetail(response)
}
