import { API_BASE_URL } from '#/api/config'
import type { MetricasGeraisResponse } from '@oda/shared-types'

export const generalMetricsQueryKey = ['general-metrics'] as const

export type GeneralMetrics = {
  totalResearchers: number
  totalResearchGroups: number
  totalProductions: number
  totalInstitutions: number
  productionCoverage: {
    doi: number
    abstract: number
    url: number
  }
}

export async function getGeneralMetrics(): Promise<GeneralMetrics> {
  const response = await fetch(`${API_BASE_URL}/metricas`)

  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao carregar métricas da API`)
  }

  const metrics = (await response.json()) as MetricasGeraisResponse

  return {
    totalResearchers: metrics.pesquisadores.totalPesquisadores,
    totalResearchGroups: metrics.gruposDePesquisa.total,
    totalProductions: metrics.producoes.total,
    totalInstitutions: metrics.instituicoes.total,
    productionCoverage: {
      doi: metrics.producoes.cobertura.doiPercentual,
      abstract: metrics.producoes.cobertura.resumoPercentual,
      url: metrics.producoes.cobertura.urlPercentual,
    },
  }
}
