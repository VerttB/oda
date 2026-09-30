import { z } from 'zod';
import {
  MetricasGruposPesquisaResponseSchema,
} from './grupos-pesquisa';
import {
  MetricasPesquisadoresResponseSchema,
} from './pesquisadores';
import {
  MetricasAreasConhecimentoResponseSchema,
} from './area-conhecimento';
import {
  MetricasProducoesResponseSchema,
} from './producoes';
import {
  MetricasInstituicoesResponseSchema,
} from './instituicoes';

const TotalPorAnoResponseSchema = z.object({
  ano: z.number().nullable(),
  total: z.number().int().min(0),
});

const TotalPorTipoProducaoResponseSchema = z.object({
  tipo: z.string(),
  total: z.number().int().min(0),
});

const TotalPorQualisResponseSchema = z.object({
  qualis: z.string().nullable(),
  total: z.number().int().min(0),
});

// Valores válidos para entidade (chaves do banco)
const ENTIDADE_VALORES = [
  'grupo_pesquisa',
  'area_conhecimento',
  'linha_pesquisa',
  'instituicao',
  'pesquisador',
  'producoes',
] as const;

export const MetricasDiariasQuerySchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataInicio deve estar no formato YYYY-MM-DD').optional(),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataFim deve estar no formato YYYY-MM-DD').optional(),
  entidade: z.union([
    z.enum(ENTIDADE_VALORES),
    z.array(z.enum(ENTIDADE_VALORES)),
  ]).optional(),
}).refine(
  (data) => {
    if (data.dataInicio && data.dataFim) {
      return new Date(data.dataInicio) <= new Date(data.dataFim);
    }
    return true;
  },
  { message: 'dataInicio deve ser anterior ou igual a dataFim', path: ['dataInicio'] }
);

export type MetricasDiariasQuery = z.infer<typeof MetricasDiariasQuerySchema>;

// Transformação de data para formato DD-MM-YYYY usando preprocess
const DataRegistroSchema = z.preprocess(
  (val) => {
    if (val instanceof Date) {
      const d = val;
      return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
    }
    if (typeof val === 'string') {
      // Se já está no formato DD-MM-YYYY, retorna como está
      if (/^\d{2}-\d{2}-\d{4}$/.test(val)) return val;
      // Se é ISO string ou outro formato, tenta parsear
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
      }
    }
    return val; // Deixa o Zod validar e dar erro se inválido
  },
  z.string().regex(/^\d{2}-\d{2}-\d{4}$/, 'dataRegistro deve estar no formato DD-MM-YYYY')
);

// Schema base para métrica diária com data no formato DD-MM-YYYY
const MetricaBaseSchema = z.object({
  dataRegistro: DataRegistroSchema,
  novosNoDia: z.number().nonnegative(),
  totalAcumulado: z.number().nonnegative()
})

export const MetricasDiariasResponseSchema = z.object({
  gruposPesquisa: z.array(MetricaBaseSchema).optional().default([]),
  areasConhecimento: z.array(MetricaBaseSchema).optional().default([]),
  linhasPesquisa: z.array(MetricaBaseSchema).optional().default([]),
  instituicoes: z.array(MetricaBaseSchema).optional().default([]),
  pesquisadores: z.array(MetricaBaseSchema).optional().default([]),
  producoes: z.array(MetricaBaseSchema).optional().default([])
})

export const MetricasFilasExtracaoResponseSchema = z.object({
  gruposPesquisa: z.object({
    comErro: z.number().int().min(0),
    porStatus: z.array(z.object({ status: z.string(), total: z.number().int().min(0) })),
  }),
  pesquisadores: z.object({
    comErro: z.number().int().min(0),
    porStatus: z.array(z.object({ status: z.string(), total: z.number().int().min(0) })),
  }),
});

export const MetricasGeraisResponseSchema = z.object({
  gruposDePesquisa: MetricasGruposPesquisaResponseSchema,
  pesquisadores: MetricasPesquisadoresResponseSchema,
  areasConhecimento: MetricasAreasConhecimentoResponseSchema,
  producoes: MetricasProducoesResponseSchema,
  instituicoes: MetricasInstituicoesResponseSchema,
  filasExtracao: MetricasFilasExtracaoResponseSchema,
});

// Export types - ONLY those defined locally in this file
export type TotalPorAnoResponse = z.infer<typeof TotalPorAnoResponseSchema>;
export type TotalPorTipoProducaoResponse = z.infer<typeof TotalPorTipoProducaoResponseSchema>;
export type TotalPorQualisResponse = z.infer<typeof TotalPorQualisResponseSchema>;
export type MetricasDiariasResponse = z.infer<typeof MetricasDiariasResponseSchema>;
export type MetricasFilasExtracaoResponse = z.infer<typeof MetricasFilasExtracaoResponseSchema>;
export type MetricasGeraisResponse = z.infer<typeof MetricasGeraisResponseSchema>;