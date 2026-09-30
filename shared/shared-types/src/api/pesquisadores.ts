import { z } from 'zod';
import { PaginationQuerySchema, SortOrderSchema } from './pagination';
import { createPaginatedResponseSchema } from './pagination';
import { TipoProducaoSchema, QualisSchema } from './producoes';
import { AreaConhecimentoResponseSchema } from './area-conhecimento';
import { GrupoPesquisaResumoResponseSchema, GrupoPesquisaInstituicaoResponseSchema } from './grupos-pesquisa';

export const TipoPesquisadorSchema = z.enum([
  'TECNICO',
  'ESTUDANTE',
  'PESQUISADOR',
  'COLABORADOR_ESTRANGEIRO',
]);

export const FormacaoAcademicaSchema = z.enum([
  'GRADUACAO',
  'ESPECIALIZACAO',
  'MESTRADO',
  'DOUTORADO',
  'OUTRO',
]);

export const CreatePesquisadorRequestSchema = z.object({
  lattesId: z.string().max(100).optional(),
  nome: z.string().min(2).max(255),
  tipo: TipoPesquisadorSchema.optional(),
  formacaoAcademica: FormacaoAcademicaSchema.optional(),
  imageUrl: z.string().optional(),
});

export const UpdatePesquisadorRequestSchema =
  CreatePesquisadorRequestSchema.partial();

const booleanQuerySchema = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const FindAllPesquisadoresQuerySchema = PaginationQuerySchema.extend({
  nome: z.string().optional(),
  formacaoAcademica: FormacaoAcademicaSchema.optional(),
  tipo: TipoPesquisadorSchema.optional(),
  lattesId: z.string().optional(),
  orcidId: z.string().optional(),
  grupoPesquisaId: z.string().uuid().optional(),
  eLider: booleanQuerySchema.optional(),
  ordenarPor: z.enum(['nome', 'tipo', 'formacaoAcademica', 'indexH']).optional(),
  ordem: SortOrderSchema.optional(),
});

export const FindPesquisadoresByGrupoQuerySchema =
  FindAllPesquisadoresQuerySchema.omit({ grupoPesquisaId: true });

export type TipoPesquisadorRequest = z.infer<typeof TipoPesquisadorSchema>;
export type FormacaoAcademicaRequest = z.infer<typeof FormacaoAcademicaSchema>;
export type CreatePesquisadorRequest = z.infer<
  typeof CreatePesquisadorRequestSchema
>;
export type UpdatePesquisadorRequest = z.infer<
  typeof UpdatePesquisadorRequestSchema
>;
export type FindAllPesquisadoresQuery = z.infer<
  typeof FindAllPesquisadoresQuerySchema
>;
export type FindPesquisadoresByGrupoQuery = z.infer<
  typeof FindPesquisadoresByGrupoQuerySchema
>;

// ==========================================
// RESPONSE SCHEMAS
// ==========================================

export const PesquisadorResumoResponseSchema = z.object({
  id: z.string(), lattesId: z.string().nullable(), nome: z.string(),
  tipo: TipoPesquisadorSchema.nullable(), formacaoAcademica: FormacaoAcademicaSchema.nullable(),
  openAlexId: z.string().nullable(), orcidId: z.string().nullable(), imageUrl: z.string().nullable(),
  indexH: z.number().nullable(), indexI10: z.number().nullable(),
});

export const ProducaoPesquisadorResponseSchema = z.object({
  id: z.string(), titulo: z.string(), ano: z.number().nullable(),
  tipo: TipoProducaoSchema,
  doi: z.string().nullable(), url: z.string().nullable(), veiculo: z.string().nullable(),
  issn: z.string().nullable(), qualis: QualisSchema.nullable(),
  resumo: z.string().nullable(), ordemAutoria: z.number().nullable(),
});

const vinculoGrupo = { eLider: z.boolean(), dataEntrada: z.string().datetime().nullable() };

export const PesquisadorResponseSchema = PesquisadorResumoResponseSchema.extend({
  producoes: z.array(ProducaoPesquisadorResponseSchema).optional(),
  // Use z.lazy to break circular dependency with grupos-pesquisa
  // Wrap the entire extend call inside the lazy function
  membrosGrupo: z.array(z.lazy(() => GrupoPesquisaResumoResponseSchema.extend(vinculoGrupo))).optional(),
  areasConhecimento: z.array(AreaConhecimentoResponseSchema).optional(),
});

export const PaginatedPesquisadorResumoResponseSchema =
  createPaginatedResponseSchema(PesquisadorResumoResponseSchema);

export const PaginatedPesquisadorResponseSchema =
  createPaginatedResponseSchema(PesquisadorResponseSchema);

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

export const PesquisadorMetricasResponseSchema = z.object({
  pesquisador: PesquisadorResumoResponseSchema,
  totais: z.object({
    grupos: z.number().int().min(0),
    gruposComoLider: z.number().int().min(0),
    linhasPesquisa: z.number().int().min(0),
    areasConhecimento: z.number().int().min(0),
    producoes: z.number().int().min(0),
  }),
  cobertura: z.object({
    producoesComDoi: z.number().int().min(0),
    producoesComDoiPercentual: z.number(),
    producoesComQualis: z.number().int().min(0),
    producoesComQualisPercentual: z.number(),
  }),
  producoesPorTipo: z.array(TotalPorTipoProducaoResponseSchema),
  producoesPorAno: z.array(TotalPorAnoResponseSchema),
  producoesPorQualis: z.array(TotalPorQualisResponseSchema),
});

export const MetricasPesquisadoresResponseSchema = z.object({
  totalPesquisadores: z.number().int().min(0),
  totalComOrcid: z.number().int().min(0),
  porFormacao: z.array(z.object({ formacao: z.string(), total: z.number().int().min(0) })),
  porTipo: z.array(z.object({ tipo: z.string(), total: z.number().int().min(0) })),
});

// Export response types
export type PesquisadorResumoResponse = z.infer<typeof PesquisadorResumoResponseSchema>;
export type PesquisadorResponse = z.infer<typeof PesquisadorResponseSchema>;
export type PaginatedPesquisadorResumoResponse = z.infer<typeof PaginatedPesquisadorResumoResponseSchema>;
export type PaginatedPesquisadorResponse = z.infer<typeof PaginatedPesquisadorResponseSchema>;
export type PesquisadorMetricasResponse = z.infer<typeof PesquisadorMetricasResponseSchema>;
export type MetricasPesquisadoresResponse = z.infer<typeof MetricasPesquisadoresResponseSchema>;