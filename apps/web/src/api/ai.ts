import {
  LangchainResponseSchema,
  PaginatedGruposPesquisaResponseSchema,
  PaginatedLinhaPesquisaResponseSchema,
  PaginatedPesquisadorResponseSchema,
  PaginatedProducaoResponseSchema,
} from '@oda/shared-types'
import type {
  LangchainGenerateRequest,
  PaginationMetaResponse,
} from '@oda/shared-types'
import { clearAuthToken, getAuthHeaders } from './auth'
import { API_BASE_URL } from './config'

export const semanticEntities = [
  'grupos',
  'pesquisadores',
  'producoes',
  'linhas',
] as const
export type SemanticEntity = (typeof semanticEntities)[number]
export const semanticLabels: Record<SemanticEntity, string> = {
  grupos: 'Grupos',
  pesquisadores: 'Pesquisadores',
  producoes: 'Produções',
  linhas: 'Linhas de pesquisa',
}
export type SemanticResult = {
  id: string
  title: string
  description: string | null
  details: string[]
  href?: string
  external?: boolean
}
export type SemanticPage = {
  data: SemanticResult[]
  meta: PaginationMetaResponse
}

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAt?: number,
  ) {
    super(message)
    this.name = 'AiRequestError'
  }
}

function getRetryAt(response: Response) {
  const value = response.headers.get('Retry-After')
  if (value && /^\d+(\.\d+)?$/.test(value))
    return Date.now() + Number(value) * 1000
  const date = value ? Date.parse(value) : NaN
  return Number.isFinite(date)
    ? Math.max(date, Date.now())
    : Date.now() + 60_000
}

async function request<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init: RequestInit,
) {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
        ...init.headers,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new AiRequestError(
      'Não foi possível conectar à API. Confira sua conexão e tente novamente.',
      0,
    )
  }
  if (!response.ok) {
    if (response.status === 401) clearAuthToken()
    const messages: Record<number, string> = {
      400: 'A consulta não foi aceita. Revise o texto e tente novamente.',
      401: 'Sua sessão expirou. Entre novamente pela área administrativa ou repita como visitante.',
      429: 'O limite compartilhado de IA foi atingido. Aguarde antes de consultar novamente.',
      503: 'Os recursos de IA estão temporariamente indisponíveis. Tente novamente mais tarde.',
      504: 'A consulta excedeu o tempo de espera. O worker pode continuar processando a solicitação. Aguarde antes de tentar novamente.',
    }
    throw new AiRequestError(
      messages[response.status] ??
        'Não foi possível concluir a consulta. Tente novamente.',
      response.status,
      response.status === 429 ? getRetryAt(response) : undefined,
    )
  }
  try {
    return schema.parse(await response.json())
  } catch {
    throw new AiRequestError(
      'A API retornou uma resposta inesperada. Tente novamente mais tarde.',
      response.status,
    )
  }
}

export async function searchSemantic(
  entity: SemanticEntity,
  q: string,
  page: number,
  signal?: AbortSignal,
): Promise<SemanticPage> {
  const query = new URLSearchParams({
    q,
    modoBusca: 'semantica',
    page: String(page),
    size: '10',
  })
  const init = { signal }
  switch (entity) {
    case 'grupos': {
      const result = await request(
        `/grupos-pesquisa?${query}`,
        PaginatedGruposPesquisaResponseSchema,
        init,
      )
      return {
        meta: result.meta,
        data: result.data.map((group) => ({
          id: group.id,
          title: group.nome,
          description: group.repercussao,
          details: [
            group.areaConhecimento?.nome || group.areaPredominante,
            group.instituicoes?.find((i) => i.tipoRelacao === 'SEDE')?.nome,
          ].filter((value): value is string => Boolean(value)),
          href: `/grupos/${encodeURIComponent(group.id)}`,
        })),
      }
    }
    case 'pesquisadores': {
      const result = await request(
        `/pesquisadores?${query}`,
        PaginatedPesquisadorResponseSchema,
        init,
      )
      return {
        meta: result.meta,
        data: result.data.map((person) => ({
          id: person.id,
          title: person.nome,
          description:
            person.areasConhecimento?.map((area) => area.nome).join(' · ') ||
            null,
          details: person.formacaoAcademica
            ? [person.formacaoAcademica.toLowerCase().replaceAll('_', ' ')]
            : [],
          href:
            person.lattesId && /^\d{16}$/.test(person.lattesId)
              ? `https://lattes.cnpq.br/${person.lattesId}`
              : undefined,
          external: true,
        })),
      }
    }
    case 'producoes': {
      const result = await request(
        `/producoes?${query}`,
        PaginatedProducaoResponseSchema,
        init,
      )
      return {
        meta: result.meta,
        data: result.data.map((work) => ({
          id: work.id,
          title: work.titulo,
          description: work.resumo,
          details: [
            work.ano?.toString(),
            work.veiculo,
            work.qualis ? `Qualis ${work.qualis}` : null,
          ].filter((value): value is string => Boolean(value)),
          href: `/producoes/${encodeURIComponent(work.id)}`,
        })),
      }
    }
    case 'linhas': {
      const result = await request(
        `/linha-pesquisa?${query}`,
        PaginatedLinhaPesquisaResponseSchema,
        init,
      )
      return {
        meta: result.meta,
        data: result.data.map((line) => ({
          id: line.id,
          title: line.titulo,
          description: line.objetivo,
          details: [],
          href: `/grupos/${encodeURIComponent(line.grupoId)}`,
        })),
      }
    }
  }
}

export function askAssistant(
  payload: LangchainGenerateRequest,
  signal?: AbortSignal,
) {
  return request('/langchain/generate', LangchainResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
}
