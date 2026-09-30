import { z } from 'zod';

// Re-export area-conhecimento - defines AreaConhecimentoResponseSchema, AreaConhecimentoDetalheResponseSchema, MetricasAreasConhecimentoResponseSchema
export {
  TipoAreaConhecimentoSchema,
  CreateAreaConhecimentoRequestSchema,
  UpdateAreaConhecimentoRequestSchema,
  FindAllAreaConhecimentoQuerySchema,
  type CreateAreaConhecimentoRequest,
  type UpdateAreaConhecimentoRequest,
  type FindAllAreaConhecimentoQuery,
  AreaConhecimentoResponseSchema,
  AreaConhecimentoDetalheResponseSchema,
  PaginatedAreaConhecimentoResponseSchema,
  MetricasAreasConhecimentoResponseSchema,
  type AreaConhecimentoResponse,
  type AreaConhecimentoDetalheResponse,
  type PaginatedAreaConhecimentoResponse,
  type MetricasAreasConhecimentoResponse,
} from './api/area-conhecimento';

// Re-export auth
export * from './api/auth';

// Re-export filas
export * from './api/filas';

// Re-export grupos-pesquisa - defines GrupoPesquisaAreaConhecimentoResponseSchema, GrupoPesquisaResumoResponseSchema, GrupoPesquisaInstituicaoResponseSchema, EstadoResponseSchema, GruposPesquisaResponseSchema, MetricasGruposPesquisaResponseSchema
export {
  SituacaoGrupoPesquisaSchema,
  TipoRelacaoGrupoInstituicaoSchema,
  GrupoPesquisaInstituicaoRequestSchema,
  CreateGruposPesquisaRequestSchema,
  UpdateGruposPesquisaRequestSchema,
  FindAllGruposPesquisaQuerySchema,
  type SituacaoGrupoPesquisa,
  type TipoRelacaoGrupoInstituicaoRequest,
  type GrupoPesquisaInstituicaoRequest,
  type CreateGruposPesquisaRequest,
  type UpdateGruposPesquisaRequest,
  type FindAllGruposPesquisaQuery,
  GrupoPesquisaAreaConhecimentoResponseSchema,
  GrupoPesquisaResumoResponseSchema,
  GrupoPesquisaInstituicaoResponseSchema,
  EstadoResponseSchema,
  GruposPesquisaResponseSchema,
  PaginatedGruposPesquisaResponseSchema,
  GrupoPesquisaMetricasResponseSchema,
  MetricasGruposPesquisaResponseSchema,
  type GrupoPesquisaAreaConhecimentoResponse,
  type GrupoPesquisaResumoResponse,
  type GrupoPesquisaInstituicaoResponse,
  type GruposPesquisaResponse,
  type PaginatedGruposPesquisaResponse,
  type GrupoPesquisaMetricasResponse,
  type MetricasGruposPesquisaResponse,
  type EstadoResponse,
} from './api/grupos-pesquisa';

// Re-export instituicoes - defines InstituicaoResponseSchema, InstituicaoResumoResponseSchema, MetricasInstituicoesResponseSchema
export {
  CreateInstituicaoRequestSchema,
  UpdateInstituicaoRequestSchema,
  FindAllInstituicaoQuerySchema,
  type CreateInstituicaoRequest,
  type UpdateInstituicaoRequest,
  type FindAllInstituicaoQuery,
  InstituicaoResponseSchema,
  InstituicaoResumoResponseSchema,
  PaginatedInstituicaoResponseSchema,
  MetricasInstituicoesResponseSchema,
  type InstituicaoResponse,
  type InstituicaoResumoResponse,
  type PaginatedInstituicaoResponse,
  type MetricasInstituicoesResponse,
} from './api/instituicoes';

// Re-export langchain
export * from './api/langchain';

// Re-export linha-pesquisa - defines LinhaPesquisaResponseSchema
export {
  CreateLinhaPesquisaRequestSchema,
  UpdateLinhaPesquisaRequestSchema,
  FindAllLinhaPesquisaQuerySchema,
  type CreateLinhaPesquisaRequest,
  type UpdateLinhaPesquisaRequest,
  type FindAllLinhaPesquisaQuery,
  LinhaPesquisaResponseSchema,
  PaginatedLinhaPesquisaResponseSchema,
  type LinhaPesquisaResponse,
  type PaginatedLinhaPesquisaResponse,
} from './api/linha-pesquisa';

// Re-export metricas - defines MetricasDiariasQuerySchema, MetricasDiariasResponseSchema, MetricasFilasExtracaoResponseSchema, MetricasGeraisResponseSchema
export {
  MetricasDiariasQuerySchema,
  MetricasDiariasResponseSchema,
  MetricasFilasExtracaoResponseSchema,
  MetricasGeraisResponseSchema,
  type MetricasDiariasQuery,
  type MetricasDiariasResponse,
  type MetricasFilasExtracaoResponse,
  type MetricasGeraisResponse,
} from './api/metricas';

// Re-export pagination
export * from './api/pagination';

// Re-export pesquisadores - defines PesquisadorResumoResponseSchema, PesquisadorResponseSchema, MetricasPesquisadoresResponseSchema
export {
  TipoPesquisadorSchema,
  FormacaoAcademicaSchema,
  CreatePesquisadorRequestSchema,
  UpdatePesquisadorRequestSchema,
  FindAllPesquisadoresQuerySchema,
  FindPesquisadoresByGrupoQuerySchema,
  type TipoPesquisadorRequest,
  type FormacaoAcademicaRequest,
  type CreatePesquisadorRequest,
  type UpdatePesquisadorRequest,
  type FindAllPesquisadoresQuery,
  type FindPesquisadoresByGrupoQuery,
  PesquisadorResumoResponseSchema,
  PesquisadorResponseSchema,
  PaginatedPesquisadorResumoResponseSchema,
  PaginatedPesquisadorResponseSchema,
  PesquisadorMetricasResponseSchema,
  MetricasPesquisadoresResponseSchema,
  type PesquisadorResumoResponse,
  type PesquisadorResponse,
  type PaginatedPesquisadorResumoResponse,
  type PaginatedPesquisadorResponse,
  type PesquisadorMetricasResponse,
  type MetricasPesquisadoresResponse,
} from './api/pesquisadores';

// Re-export producoes - defines ProducaoResponseSchema, ProducaoPesquisadorResponseSchema, MetricasProducoesResponseSchema
export {
  TipoProducaoSchema,
  QualisSchema,
  ProducaoAutorRequestSchema,
  CreateProducaoRequestSchema,
  UpdateProducaoRequestSchema,
  FindAllProducoesQuerySchema,
  FindProducoesByPesquisadorQuerySchema,
  type CreateProducaoRequest,
  type UpdateProducaoRequest,
  type FindAllProducoesQuery,
  type FindProducoesByPesquisadorQuery,
  ProducaoResponseSchema,
  ProducaoPesquisadorResponseSchema,
  PaginatedProducaoResponseSchema,
  MetricasProducoesResponseSchema,
  type ProducaoResponse,
  type ProducaoPesquisadorResponse,
  type PaginatedProducaoResponse,
  type MetricasProducoesResponse,
} from './api/producoes';

// Re-export simcc
export * from './simcc';

// Local schemas
export const PageGroupItemInfoSchema = z.object({
  nome: z.string(),
  area: z.string(),
  instituicao: z.string(),
  key: z.string(),
});
export type PageGroupItemInfo = z.infer<typeof PageGroupItemInfoSchema>;

export const RequestTypeSchema = z.object({
  url: z.string(),
  userData: z.object({
    chave: z.string(),
    direction: z.string(),
  }),
  uniqueKey: z.string(),
});
export type RequestType = z.infer<typeof RequestTypeSchema>;

export const AddressSchema = z.object({
  cep: z.string().optional().nullable(),
  localidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  long: z.number().optional().nullable(),
});
export type Address = z.infer<typeof AddressSchema>;

export const MembrosGrupoSchema = z.object({
  nome: z.string(),
  lattes: z.string().optional().nullable(),
  lattesId: z.string().optional().nullable(),
  formacaoAcademica: z.string().optional().nullable(),
  categoriaLattes: z.string().optional().nullable(),
  areas: z.array(z.string()).optional().nullable(),
  gruposAssociados: z.array(z.string()).optional().nullable(),
  linhasAssociadas: z.array(z.string()).optional().nullable(),
});
export type MembrosGrupo = z.infer<typeof MembrosGrupoSchema>;

export const FormationSchema = z.object({
  anoInicio: z.string().optional().nullable(),
  anoFim: z.string().optional().nullable(),
  nome: z.string().optional().nullable(),
});
export type Formation = z.infer<typeof FormationSchema>;

export const ArticleSchema = z.object({
  titulo: z.string(),
  doi: z.string().optional().nullable(),
  volume: z.string().optional().nullable(),
  issn: z.string().optional().nullable(),
  nomePeriodico: z.string().optional().nullable(),
  veiculo: z.string().optional().nullable(),
  paginaInicial: z.string().optional().nullable(),
  ano: z.string().optional().nullable(),
  resumo: z.string().optional().nullable(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const FullPaperSchema = z.object({
  titulo: z.string(),
  ano: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
});
export type FullPaper = z.infer<typeof FullPaperSchema>;

export const BookChaptersSchema = z.object({
  titulo: z.string(),
  ano: z.string().optional().nullable(),
  doi: z.string().optional().nullable(),
  volume: z.string().optional().nullable(),
  paginas: z.string().optional().nullable(),
  editora: z.string().optional().nullable(),
  veiculo: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
});
export type BookChapters = z.infer<typeof BookChaptersSchema>;

export const LinhaPesquisaGrupoSchema = z.object({
  nome: z.string(),
  objetivo: z.string().optional().nullable(),
  areasConhecimento: z.array(z.string()).optional().nullable(),
  plavrasChaves: z.array(z.string()).optional().nullable(),
  setoresAplicacao: z.array(z.string()).optional().nullable(),
});
export type LinhaPesquisaGrupo = z.infer<typeof LinhaPesquisaGrupoSchema>;

export const UnidadeInstituicaoSchema = z.object({
  nome: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
});
export type UnidadeInstituicao = z.infer<typeof UnidadeInstituicaoSchema>;

export const InstituicaoGrupoRelacaoSchema = z.object({
  nome: z.string(),
  sigla: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  tipoRelacao: z.enum(['SEDE', 'PARCEIRA']),
  unidade: z.union([z.string(), UnidadeInstituicaoSchema]).optional().nullable(),
});
export type InstituicaoGrupoRelacao = z.infer<typeof InstituicaoGrupoRelacaoSchema>;

export const DgpGroupSchema = z.object({
  id_dgp: z.string().optional().nullable(),
  idDgp: z.string().optional().nullable(),
  nome: z.string(),
  situacao: z.string().optional().nullable(),
  repercussao: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  instituicao: z.string(),
  unidade: z.string().optional().nullable(),
  instituicoes: z.array(InstituicaoGrupoRelacaoSchema).optional().nullable(),
  ano_formacao: z.union([z.number(), z.string()]).optional().nullable(),
  anoFormacao: z.union([z.number(), z.string()]).optional().nullable(),
  endereco: AddressSchema,
  membros: z.array(MembrosGrupoSchema),
  linhas: z.union([LinhaPesquisaGrupoSchema, z.array(LinhaPesquisaGrupoSchema)]).optional().nullable(),
});
export type DgpGroup = z.infer<typeof DgpGroupSchema>;

export const LattesResearcherSchema = z.object({
  nome: z.string(),
  lattesId: z.string().optional().nullable(),
  orcid: z.string().optional().nullable(),
  orcidId: z.string().optional().nullable(),
  artigos: z.array(ArticleSchema).optional().nullable(),
  livrosCapitulos: z.array(BookChaptersSchema).optional().nullable(),
});
export type LattesResearcher = z.infer<typeof LattesResearcherSchema>;

// ==========================================
// SCHEMAS DE METADADOS DO PIPELINE LOG
// ==========================================

export const ScraperMetadataSchema = z.object({
  tamanhoTotalBytes: z.number().int().nonnegative().optional(),
  tamanhoFormatado: z.string().optional(),
  arquivosJsonGerados: z.number().int().nonnegative().optional(),
  navegador: z.string().optional(),
  comando: z.string().optional(),
  chaves: z.array(z.string()).optional(),
  direcao: z.string().optional(),
  pagina: z.number().int().positive().optional(),
  itensFila: z.number().int().nonnegative().optional(),
  gruposPendentes: z.number().int().nonnegative().optional(),
  pesquisadoresPendentes: z.number().int().nonnegative().optional(),
  paginasProcessadas: z.number().int().nonnegative().optional(),
  itensDescobertos: z.number().int().nonnegative().optional(),
  itensPulados: z.number().int().nonnegative().optional(),
  itensComErro: z.number().int().nonnegative().optional(),
  tamanhoCacheInicial: z.number().int().nonnegative().optional(),
  tamanhoCacheFinal: z.number().int().nonnegative().optional(),
  gruposExtraidos: z.number().int().nonnegative().optional(),
  pesquisadoresExtraidos: z.number().int().nonnegative().optional(),
  pesquisadoresComErro: z.number().int().nonnegative().optional(),
  membrosExtraidos: z.number().int().nonnegative().optional(),
  linhasExtraidas: z.number().int().nonnegative().optional(),
  instituicoesExtraidas: z.number().int().nonnegative().optional(),
  pesquisadoresEnfileirados: z.number().int().nonnegative().optional(),
  dgpRecuperacoesEspelho: z.number().int().nonnegative().optional(),
  dgpRedirecionamentosLogin: z.number().int().nonnegative().optional(),
  dgpTempoRecuperacaoMs: z.number().int().nonnegative().optional(),
  dgpRecuperacoesPorEtapa: z.record(z.string(), z.number().int().nonnegative()).optional(),
  arquivoJson: z.string().optional(),
}).passthrough();
export type ScraperMetadata = z.infer<typeof ScraperMetadataSchema>;

export const EtlMetadataSchema = z.object({
  gruposGravados: z.number().int().nonnegative().optional(),
  pesquisadoresAtualizados: z.number().int().nonnegative().optional(),
  linhasPesquisaGravadas: z.number().int().nonnegative().optional(),
  producoesVinculadas: z.number().int().nonnegative().optional(),
  qualisAssociados: z.number().int().nonnegative().optional(),
  comando: z.string().optional(),
  arquivoJson: z.string().optional(),
  tamanhoTotalBytes: z.number().int().nonnegative().optional(),
  linhasPesquisaEncontradas: z.number().int().nonnegative().optional(),
  membrosEncontrados: z.number().int().nonnegative().optional(),
  pesquisadoresElegiveis: z.number().int().nonnegative().optional(),
  artigosEncontrados: z.number().int().nonnegative().optional(),
  livrosCapitulosEncontrados: z.number().int().nonnegative().optional(),
}).passthrough();
export type EtlMetadata = z.infer<typeof EtlMetadataSchema>;

export const RagMetadataSchema = z.object({
  quantidadeChunks: z.number().int().nonnegative().optional(),
  tamanhoMedioChunk: z.number().int().positive().optional(),
  modeloEmbedding: z.string().optional(),
  totalTokensEstimados: z.number().int().nonnegative().optional(),
}).passthrough();
export type RagMetadata = z.infer<typeof RagMetadataSchema>;

export const PipelineMetadataSchema = z.union([
  ScraperMetadataSchema,
  EtlMetadataSchema,
  RagMetadataSchema,
]);
export type PipelineMetadata = z.infer<typeof PipelineMetadataSchema>;