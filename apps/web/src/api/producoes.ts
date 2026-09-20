import type {
  AcademicAuthor,
  AcademicProductionDetailData,
  ProductionItem,
} from '#/core/interfaces'
import type {
  FindAllProducoesQuery,
  PaginatedProducaoResponse,
  ProducaoResponse,
} from '@oda/shared-types'

const REMOTE_API_BASE_URL = 'https://oda.vertb.com.br'

const DEFAULT_API_BASE_URL = import.meta.env.SSR
  ? REMOTE_API_BASE_URL
  : import.meta.env.DEV
    ? '/api'
    : REMOTE_API_BASE_URL

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL
).replace(/\/$/, '')

export type ProductionTypeFilter = NonNullable<FindAllProducoesQuery['tipo']>

export type ProductionsFilters = Partial<FindAllProducoesQuery>

export const productionsQueryKey = (filters: ProductionsFilters = {}) => [
  'productions',
  filters,
]

export const productionDetailQueryKey = (producaoId: string) => [
  'production',
  producaoId,
]

export type ProductionsPage = {
  data: ProductionItem[]
  meta: {
    page: number
    size: number
    totalItems: number
    totalPages: number
  }
}

type ProducaoAutorResponse = NonNullable<ProducaoResponse['autores']>[number]

type ProducaoPalavraChaveResponse = NonNullable<
  ProducaoResponse['palavrasChave']
>[number]

function getProductionsFromResponse(
  response: ProducaoResponse[] | PaginatedProducaoResponse,
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

  const data = response.data

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function getStringField(
  record: Record<string, unknown> | null,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = record?.[key]

    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return undefined
}

function getNumberField(
  record: Record<string, unknown> | null,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = record?.[key]

    if (typeof value === 'number') {
      return value
    }
  }

  return undefined
}

function mapProduction(production: ProducaoResponse): ProductionItem {
  const productionRecord = asRecord(production)
  const group = asRecord(productionRecord?.grupo)
  const researchGroup = asRecord(productionRecord?.grupoPesquisa)
  const institution = asRecord(productionRecord?.instituicao)
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
    citations: getNumberField(productionRecord, 'citations', 'citacoes') ?? 0,
    doi: production.doi ?? undefined,
    url: production.url ?? undefined,
    abstract: production.resumo ?? undefined,
    groupName:
      getStringField(researchGroup, 'nome') ?? getStringField(group, 'nome'),
    institution: getStringField(institution, 'sigla', 'nome'),
    keywords: production.palavrasChave?.map(getKeywordLabel).filter(Boolean),
    issn: production.issn ?? undefined,
    pages: getStringField(productionRecord, 'pages', 'paginas'),
    qualisArea: getStringField(productionRecord, 'qualisArea'),
  }
}

function getKeywordLabel(keyword: ProducaoPalavraChaveResponse) {
  const keywordRecord = asRecord(keyword)
  const nestedKeyword = asRecord(keywordRecord?.palavraChave)

  return (
    getStringField(keywordRecord, 'nome', 'palavra', 'termo') ??
    getStringField(nestedKeyword, 'nome', 'palavra', 'termo') ??
    ''
  )
}

function mapProductionAuthor(author: ProducaoAutorResponse): AcademicAuthor {
  const authorRecord = asRecord(author)
  const researcher = asRecord(authorRecord?.pesquisador)
  const institution = asRecord(researcher?.instituicao)
  const name =
    getStringField(researcher, 'nome') ??
    getStringField(authorRecord, 'nome') ??
    'Autor não informado'

  return {
    id:
      getStringField(researcher, 'id') ??
      getStringField(authorRecord, 'pesquisadorId'),
    name,
    institution: getStringField(institution, 'sigla', 'nome'),
    isExternal:
      getStringField(researcher, 'tipo') === 'COLABORADOR_ESTRANGEIRO',
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
  production: ProducaoResponse,
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
  const response = await fetchJson<
    ProducaoResponse[] | PaginatedProducaoResponse
  >(`/producoes${query ? `?${query}` : ''}`)
  const page = getProductionsFromResponse(response)

  return {
    data: page.data.map(mapProduction),
    meta: page.meta,
  }
}

export async function getProductionDetail(
  producaoId: string,
): Promise<AcademicProductionDetailData> {
  const response = await fetchJson<ProducaoResponse>(`/producoes/${producaoId}`)

  return mapProductionDetail(response)
}
