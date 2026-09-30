import { z } from 'zod';
import { PaginationQuerySchema, SortOrderSchema } from './pagination';
import { createPaginatedResponseSchema } from './pagination';
import { TipoAreaConhecimentoSchema } from './area-conhecimento';
import { TipoPesquisadorSchema, FormacaoAcademicaSchema, PesquisadorResumoResponseSchema } from './pesquisadores';
import { TipoProducaoSchema, QualisSchema, ProducaoPesquisadorResponseSchema } from './producoes';

export const SituacaoGrupoPesquisaSchema = z.enum([
  'CERTIFICADO',
  'EM_PREENCHIMENTO',
  'EXCLUIDO',
  'AGUARDANDO_CERTIFICACAO',
  // Retidos para leitura de registros legados já persistidos.
  'INATIVO',
  'EM_ANALISE',
]);

export const TipoRelacaoGrupoInstituicaoSchema = z.enum(['SEDE', 'PARCEIRA']);

export const GrupoPesquisaInstituicaoRequestSchema = z.object({
  instituicaoId: z.string().uuid(),
  tipoRelacao: TipoRelacaoGrupoInstituicaoSchema.optional(),
  unidade: z.string().optional(),
  unidadeUf: z.string().optional(),
});

export const CreateGruposPesquisaRequestSchema = z.object({
  dgpId: z.string().optional(),
  nome: z.string(),
  anoFormacao: z.coerce.number().int().optional(),
  areaPredominante: z.string(),
  repercussao: z.string().optional(),
  situacao: SituacaoGrupoPesquisaSchema,
  instituicoes: z.array(GrupoPesquisaInstituicaoRequestSchema).nonempty(),
});

export const UpdateGruposPesquisaRequestSchema =
  CreateGruposPesquisaRequestSchema.partial();

export const FindAllGruposPesquisaQuerySchema = PaginationQuerySchema.extend({
  situacao: SituacaoGrupoPesquisaSchema.optional(),
  nome: z.string().optional(),
  anoFormacao: z.coerce.number().int().optional(),
  instituicaoId: z.string().uuid().optional(),
  areaConhecimentoId: z.string().uuid().optional(),
  estadoId: z.string().uuid().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  ordenarPor: z.enum(['nome', 'anoFormacao', 'situacao']).optional(),
  ordem: SortOrderSchema.optional(),
});

export type SituacaoGrupoPesquisa = z.infer<typeof SituacaoGrupoPesquisaSchema>;
export type TipoRelacaoGrupoInstituicaoRequest = z.infer<
  typeof TipoRelacaoGrupoInstituicaoSchema
>;
export type GrupoPesquisaInstituicaoRequest = z.infer<
  typeof GrupoPesquisaInstituicaoRequestSchema
>;
export type CreateGruposPesquisaRequest = z.infer<
  typeof CreateGruposPesquisaRequestSchema
>;
export type UpdateGruposPesquisaRequest = z.infer<
  typeof UpdateGruposPesquisaRequestSchema
>;
export type FindAllGruposPesquisaQuery = z.infer<
  typeof FindAllGruposPesquisaQuerySchema
>;

// ==========================================
// RESPONSE SCHEMAS
// ==========================================

export const AreaConhecimentoResponseSchema = z.object({
  id: z.string(), nome: z.string(), nomeNormalizado: z.string(),
  tipo: TipoAreaConhecimentoSchema.nullable().optional(),
  areaPaiId: z.string().nullable(),
});

export const AreaConhecimentoDetalheResponseSchema = AreaConhecimentoResponseSchema.extend({
  areaPai: AreaConhecimentoResponseSchema.nullable().optional(),
  subareas: z.array(AreaConhecimentoResponseSchema).optional(),
});

export const GrupoPesquisaAreaConhecimentoResponseSchema = AreaConhecimentoResponseSchema.extend({
  relacao: z.enum(['PRINCIPAL', 'ADICIONAL']),
  metodoInferencia: z.enum(['DGP', 'IA', 'MANUAL']),
  confianca: z.number().nullable(),
  justificativa: z.string().nullable(),
  metadata: z.unknown().nullable().optional(),
});

export const GrupoPesquisaResumoResponseSchema = z.object({
  id: z.string(), dgpId: z.string().nullable(), nome: z.string(),
  anoFormacao: z.number().nullable(), areaPredominante: z.string(),
  repercussao: z.string().nullable(), situacao: SituacaoGrupoPesquisaSchema,
  email: z.string().nullable(), telefone: z.string().nullable(), website: z.string().nullable(),
  logradouro: z.string().nullable(), numero: z.string().nullable(), complemento: z.string().nullable(),
  bairro: z.string().nullable(), cidade: z.string().nullable(), uf: z.string().nullable(), cep: z.string().nullable(),
  latitude: z.number().nullable(), longitude: z.number().nullable(),
});

export const GrupoPesquisaInstituicaoResponseSchema = z.object({
  id: z.string(), nome: z.string(), sigla: z.string(),
  imageUrl: z.string().nullable(),
  tipoRelacao: TipoRelacaoGrupoInstituicaoSchema,
  unidade: z.object({ nome: z.string().nullable(), uf: z.string().nullable() }).nullable(),
  estado: z.object({ id: z.string(), sigla: z.string(), nome: z.string(), regiao: z.string() }).nullable(),
});

const vinculoGrupo = { eLider: z.boolean(), dataEntrada: z.string().datetime().nullable() };

export const GruposPesquisaResponseSchema = GrupoPesquisaResumoResponseSchema.extend({
  instituicoes: z.array(GrupoPesquisaInstituicaoResponseSchema).optional(),
  areaConhecimento: AreaConhecimentoResponseSchema.nullable().optional(),
  areasConhecimento: z.array(GrupoPesquisaAreaConhecimentoResponseSchema).optional(),
  linhasPesquisa: z.array(z.object({
    id: z.string(), dgpId: z.string().nullable(), titulo: z.string(), objetivo: z.string().nullable(),
  })).optional(),
  // Use z.lazy to break circular dependency with pesquisadores
  // Wrap the entire extend call inside the lazy function
  membros: z.array(z.lazy(() => PesquisadorResumoResponseSchema.extend(vinculoGrupo))).optional(),
});

export const PaginatedGruposPesquisaResponseSchema =
  createPaginatedResponseSchema(GruposPesquisaResponseSchema);

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

export const GrupoPesquisaMetricasResponseSchema = z.object({
  grupo: GruposPesquisaResponseSchema,
  totais: z.object({
    pesquisadores: z.number().int().min(0),
    pesquisadoresComLattes: z.number().int().min(0),
    linhasPesquisa: z.number().int().min(0),
    areasConhecimento: z.number().int().min(0),
    areasConhecimentoPrincipais: z.number().int().min(0),
    areasConhecimentoAdicionais: z.number().int().min(0),
    producoes: z.number().int().min(0),
    instituicoesParceiras: z.number().int().min(0),
  }),
  cobertura: z.object({
    pesquisadoresComLattesPercentual: z.number(),
    producoesComDoi: z.number().int().min(0),
    producoesComDoiPercentual: z.number(),
    producoesComQualis: z.number().int().min(0),
    producoesComQualisPercentual: z.number(),
  }),
  pesquisadoresPorTipo: z.array(z.object({
    tipo: z.string(),
    total: z.number().int().min(0),
  })),
  pesquisadoresPorFormacao: z.array(z.object({
    formacao: z.string(),
    total: z.number().int().min(0),
  })),
  producoesPorAno: z.array(TotalPorAnoResponseSchema),
  producoesPorTipo: z.array(TotalPorTipoProducaoResponseSchema),
  producoesPorQualis: z.array(TotalPorQualisResponseSchema),
});

export const MetricasGruposPesquisaResponseSchema = z.object({
  total: z.number().int().min(0),
  porUf: z.array(z.object({
    uf: z.string(),
    total: z.number().int().min(0),
  })),
  porInstituicao: z.array(z.object({
    instituicaoId: z.string(),
    nome: z.string().nullable(),
    sigla: z.string().nullable(),
    uf: z.string().nullable(),
    total: z.number().int().min(0),
    sede: z.number().int().min(0),
    parceira: z.number().int().min(0),
  })),
});

export const EstadoResponseSchema = z.object({
  id: z.string(),
  sigla: z.string(),
  nome: z.string(),
  regiao: z.string(),
});

// Export response types
export type GrupoPesquisaAreaConhecimentoResponse = z.infer<typeof GrupoPesquisaAreaConhecimentoResponseSchema>;
export type GrupoPesquisaResumoResponse = z.infer<typeof GrupoPesquisaResumoResponseSchema>;
export type GrupoPesquisaInstituicaoResponse = z.infer<typeof GrupoPesquisaInstituicaoResponseSchema>;
export type GruposPesquisaResponse = z.infer<typeof GruposPesquisaResponseSchema>;
export type PaginatedGruposPesquisaResponse = z.infer<typeof PaginatedGruposPesquisaResponseSchema>;
export type GrupoPesquisaMetricasResponse = z.infer<typeof GrupoPesquisaMetricasResponseSchema>;
export type MetricasGruposPesquisaResponse = z.infer<typeof MetricasGruposPesquisaResponseSchema>;
export type EstadoResponse = z.infer<typeof EstadoResponseSchema>;
