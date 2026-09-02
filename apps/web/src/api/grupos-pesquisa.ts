import type {
  Author,
  DirectoryGroupItem,
  ResearchGroupDetail,
  ResearchLine,
} from '#/core/interfaces'

export const researchGroupsQueryKey = ['research-groups']

export const researchGroupsMetricsQueryKey = ['research-groups-metrics']

export const researchGroupDetailQueryKey = (grupoId: string) => [
  'research-group',
  grupoId,
]

const REMOTE_API_BASE_URL = 'https://oda.vertb.com.br'

const DEFAULT_API_BASE_URL = import.meta.env.SSR
  ? REMOTE_API_BASE_URL
  : import.meta.env.DEV
    ? '/api'
    : REMOTE_API_BASE_URL

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL
).replace(/\/$/, '')

const DEFAULT_AVATAR = '/headshot-on-white.jpg'

type ApiInstituicao = {
  nome?: string | null
  sigla?: string | null
  estado?: {
    sigla?: string | null
    nome?: string | null
  } | null
}

type ApiGrupoInstituicao = {
  tipoRelacao?: string | null
  unidade?: string | null
  unidadeUf?: string | null
  instituicao?: ApiInstituicao | null
}

type ApiAreaConhecimento = {
  area?: {
    nome?: string | null
  } | null
}

type ApiLinhaPesquisa = {
  id?: string | null
  titulo?: string | null
  objetivo?: string | null
}

type ApiPesquisador = {
  id?: string | null
  nome?: string | null
  tipo?: string | null
  formacaoAcademica?: string | null
  imageUrl?: string | null
}

type ApiMembroGrupo = {
  eLider?: boolean | null
  pesquisador?: ApiPesquisador | null
}

type ApiGrupoPesquisa = {
  id: string
  dgpId?: string | null
  nome?: string | null
  anoFormacao?: number | null
  areaPredominante?: string | null
  repercussao?: string | null
  email?: string | null
  website?: string | null
  cidade?: string | null
  uf?: string | null
  instituicoes?: ApiGrupoInstituicao[] | null
  areasConhecimento?: ApiAreaConhecimento[] | null
  linhasPesquisa?: ApiLinhaPesquisa[] | null
  membros?: ApiMembroGrupo[] | null
}

type ApiPaginatedResponse<T> = {
  data?: T[]
  items?: T[]
  results?: T[]
  total?: number
  meta?: {
    total?: number
    totalItems?: number
  }
}

type ApiGrupoMetricas = {
  totais?: {
    pesquisadores?: number
    linhasPesquisa?: number
    producoes?: number
  }
}

type ApiGruposPesquisaMetricas = {
  total: number
  porUf: {
    uf: string
    total: number
  }[]
  porInstituicao: {
    instituicaoId: string
    nome?: string | null
    sigla?: string | null
    uf?: string | null
    total: number
    sede: number
    parceira: number
  }[]
}

export type ResearchGroupsDirectoryMetrics = {
  total: number
  topUfs: {
    uf: string
    count: number
  }[]
  topInstitutions: {
    id: string
    name: string
    code: string
    uf?: string
    count: number
    hostCount: number
    partnerCount: number
  }[]
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null
}

function normalizeApiAssetUrl(url?: string | null) {
  if (!url) {
    return DEFAULT_AVATAR
  }

  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`
  }

  return url
}

function normalizeExternalUrl(url?: string | null) {
  if (!url) {
    return ''
  }

  if (/^https?:\/\//i.test(url)) {
    return url
  }

  return `https://${url}`
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao carregar dados da API`)
  }

  return response.json() as Promise<T>
}

async function fetchOptionalJson<T>(
  path: string,
  timeoutMs = 3000,
): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetchJson<T>(path, { signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function getInstitutionName(vinculo?: ApiGrupoInstituicao) {
  return (
    vinculo?.instituicao?.nome ??
    vinculo?.unidade ??
    'Instituição não informada'
  )
}

function getInstitutionCode(vinculo?: ApiGrupoInstituicao) {
  return vinculo?.instituicao?.sigla ?? vinculo?.unidadeUf ?? '--'
}

function getInstitutionLocation(vinculo?: ApiGrupoInstituicao) {
  return vinculo?.instituicao?.estado?.sigla ?? vinculo?.unidadeUf ?? null
}

function isHostInstitution(vinculo: ApiGrupoInstituicao) {
  return vinculo.tipoRelacao?.toUpperCase() === 'SEDE'
}

function formatResearcherRole(member: ApiMembroGrupo) {
  if (member.eLider) {
    return 'Líder'
  }

  const tipo = member.pesquisador?.tipo

  if (!tipo) {
    return 'Membro'
  }

  return tipo
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function mapMemberToAuthor(member: ApiMembroGrupo): Author | null {
  const researcher = member.pesquisador

  if (!researcher?.id || !researcher.nome) {
    return null
  }

  return {
    id: researcher.id,
    name: researcher.nome,
    role: formatResearcherRole(member),
    avatar: normalizeApiAssetUrl(researcher.imageUrl),
    institution: researcher.formacaoAcademica ?? undefined,
  }
}

function mapResearchLine(line: ApiLinhaPesquisa): ResearchLine | null {
  if (!line.titulo) {
    return null
  }

  return {
    title: line.titulo,
    isMainFocus: false,
    area: 'Linha de pesquisa',
    description: line.objetivo ?? 'Objetivo não informado.',
    keywords: [],
    applicationSectors: [],
  }
}

function getGroupHostInstitution(group: ApiGrupoPesquisa) {
  const institutions = group.instituicoes ?? []

  return institutions.find(isHostInstitution) ?? institutions[0]
}

function mapGroupListItem(group: ApiGrupoPesquisa): DirectoryGroupItem {
  const hostInstitution = getGroupHostInstitution(group)
  const members = (group.membros ?? []).map(mapMemberToAuthor).filter(isPresent)
  const leaders = (group.membros ?? [])
    .filter((member) => member.eLider)
    .map((member) => member.pesquisador?.nome)
    .filter(isPresent)

  return {
    id: group.id,
    name: group.nome ?? 'Grupo sem nome',
    institution: getInstitutionCode(hostInstitution),
    knowledgeArea:
      group.areaPredominante ??
      group.areasConhecimento?.[0]?.area?.nome ??
      'Área não informada',
    status: 'Ativo',
    uf: group.uf ?? getInstitutionLocation(hostInstitution) ?? '--',
    since: group.anoFormacao ? String(group.anoFormacao) : 'Não informado',
    membersCount: members.length,
    leaders,
    description: group.repercussao ?? undefined,
    linesOfResearch: (group.linhasPesquisa ?? [])
      .map((line) => line.titulo)
      .filter(isPresent),
  }
}

function getGroupsFromResponse(
  response: ApiGrupoPesquisa[] | ApiPaginatedResponse<ApiGrupoPesquisa>,
) {
  if (Array.isArray(response)) {
    return response
  }

  return response.data ?? response.items ?? response.results ?? []
}

function mapGroupDetail(
  group: ApiGrupoPesquisa,
  metrics: ApiGrupoMetricas | null,
): ResearchGroupDetail {
  const institutions = group.instituicoes ?? []
  const hostInstitution = getGroupHostInstitution(group)
  const partnerInstitutions = institutions.filter(
    (institution) => institution !== hostInstitution,
  )
  const members = (group.membros ?? []).map(mapMemberToAuthor).filter(isPresent)
  const leaders = (group.membros ?? [])
    .filter((member) => member.eLider)
    .map(mapMemberToAuthor)
    .filter(isPresent)

  const primaryArea =
    group.areaPredominante ??
    group.areasConhecimento?.[0]?.area?.nome ??
    'Área não informada'

  return {
    id: group.id,
    name: group.nome ?? 'Grupo sem nome',
    primaryArea,
    secondaryTag: group.dgpId ? `DGP ${group.dgpId}` : 'Grupo de Pesquisa',
    description: group.repercussao ?? 'Descrição não informada.',
    stats: {
      members: metrics?.totais?.pesquisadores ?? members.length,
      publications: metrics?.totais?.producoes ?? 0,
      projects:
        metrics?.totais?.linhasPesquisa ?? group.linhasPesquisa?.length ?? 0,
      formationYear: group.anoFormacao ?? 0,
      location:
        [group.cidade, group.uf].filter(Boolean).join(', ') ||
        'Local não informado',
    },
    coverImage: '',
    institutionalAffiliation: {
      hostInstitution: {
        name: getInstitutionName(hostInstitution),
        code: getInstitutionCode(hostInstitution),
      },
      partnerInstitutions: partnerInstitutions.map((institution) => ({
        name: getInstitutionName(institution),
        code: getInstitutionCode(institution),
      })),
    },
    contactInfo: {
      website: normalizeExternalUrl(group.website),
      email: group.email ?? '',
      socialHandle: getInstitutionLocation(hostInstitution) ?? '',
    },
    researchLines: (group.linhasPesquisa ?? [])
      .map(mapResearchLine)
      .filter(isPresent),
    leaders,
    members,
  }
}

export async function getResearchGroups() {
  const response = await fetchJson<
    ApiGrupoPesquisa[] | ApiPaginatedResponse<ApiGrupoPesquisa>
  >('/grupos-pesquisa')

  return getGroupsFromResponse(response).map(mapGroupListItem)
}

export async function getResearchGroupsMetrics(): Promise<ResearchGroupsDirectoryMetrics> {
  const metrics = await fetchJson<ApiGruposPesquisaMetricas>(
    '/metricas/grupos-pesquisa',
  )

  return {
    total: metrics.total,
    topUfs: metrics.porUf
      .map((item) => ({
        uf: item.uf,
        count: item.total,
      }))
      .sort((a, b) => b.count - a.count),
    topInstitutions: metrics.porInstituicao.map((item) => ({
      id: item.instituicaoId,
      name: item.sigla ?? item.nome ?? 'Instituição sem nome',
      code: item.sigla ?? '--',
      uf: item.uf ?? undefined,
      count: item.total,
      hostCount: item.sede,
      partnerCount: item.parceira,
    })),
  }
}

export async function getResearchGroupDetail(grupoId: string) {
  const [group, metrics] = await Promise.all([
    fetchJson<ApiGrupoPesquisa>(`/grupos-pesquisa/${grupoId}`),
    fetchOptionalJson<ApiGrupoMetricas>(`/metricas/grupos-pesquisa/${grupoId}`),
  ])

  return mapGroupDetail(group, metrics)
}
