import { z } from 'zod';

export const FilaNomeSchema = z.enum(['dgp', 'lattes', 'discovery', 'etl-grupos', 'etl-pesquisadores']);
export const WorkerStatusSchema = z.enum(['ATIVO']);

export const WorkerFilaResponseSchema = z.object({
  id: z.string(),
  fila: FilaNomeSchema,
  status: WorkerStatusSchema,
  nome: z.string().nullable(),
  endereco: z.string().nullable(),
  conectadoHaSegundos: z.number().int().nonnegative(),
  conexaoOciosaHaSegundos: z.number().int().nonnegative(),
});

export const WorkersAtivosResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  workers: z.array(WorkerFilaResponseSchema),
});

export const EnfileirarDgpRequestSchema = z.object({
  dgpId: z.string().regex(/^\d{16}$/, 'dgpId deve conter exatamente 16 digitos'),
});

export const EnfileirarDgpResponseSchema = z.object({
  fila: z.literal('dgp'),
  jobId: z.string(),
  pipelineLogId: z.string().uuid(),
  estado: z.string(),
  duplicado: z.boolean(),
});

export const DgpJobEtapaSchema = z.enum([
  'INICIANDO',
  'ABRINDO_ESPELHO',
  'DADOS_GERAIS',
  'RECURSOS_HUMANOS',
  'INSTITUICOES',
  'LINHAS_PESQUISA',
  'SALVANDO_JSON',
  'ENFILEIRANDO_PESQUISADORES',
  'CONCLUIDO',
]);

export const DgpJobProgressSchema = z.object({
  etapa: DgpJobEtapaSchema,
  percentual: z.number().int().min(0).max(100),
  itensProcessados: z.number().int().nonnegative().nullable(),
  itensTotal: z.number().int().nonnegative().nullable(),
  progressoEm: z.iso.datetime(),
});

export const DgpJobResponseSchema = z.object({
  fila: z.literal('dgp'),
  jobId: z.string(),
  dgpId: z.string(),
  pipelineLogId: z.string().uuid(),
  estado: z.string(),
  worker: z.string().nullable(),
  tentativaAtual: z.number().int().nonnegative(),
  tentativasMaximas: z.number().int().positive(),
  iniciadoEm: z.iso.datetime().nullable(),
  finalizadoEm: z.iso.datetime().nullable(),
  ultimoErro: z.string().nullable(),
  progresso: DgpJobProgressSchema,
});

export const DgpJobsAtivosResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  jobs: z.array(DgpJobResponseSchema),
});

export const EnfileirarLattesRequestSchema = z.object({
  lattesId: z.string().regex(/^\d{16}$/, 'lattesId deve conter exatamente 16 digitos'),
});

export const EnfileirarLattesResponseSchema = EnfileirarDgpResponseSchema.extend({
  fila: z.literal('lattes'),
});

export const LattesJobEtapaSchema = z.enum([
  'INICIANDO',
  'BUSCANDO',
  'ANALISANDO_RESULTADOS',
  'ABRINDO_CURRICULO',
  'EXTRAINDO_CURRICULO',
  'SALVANDO_JSON',
  'BAIXANDO_IMAGEM',
  'CONCLUIDO',
]);

export const LattesJobProgressSchema = z.object({
  etapa: LattesJobEtapaSchema,
  percentual: z.number().int().min(0).max(100),
  paginaAtual: z.number().int().positive().nullable(),
  paginasTotal: z.number().int().positive().nullable(),
  progressoEm: z.iso.datetime(),
});

export const LattesJobResponseSchema = z.object({
  fila: z.literal('lattes'),
  jobId: z.string(),
  lattesId: z.string(),
  nome: z.string(),
  pipelineLogId: z.string().uuid(),
  estado: z.string(),
  worker: z.string().nullable(),
  tentativaAtual: z.number().int().nonnegative(),
  tentativasMaximas: z.number().int().positive(),
  iniciadoEm: z.iso.datetime().nullable(),
  finalizadoEm: z.iso.datetime().nullable(),
  ultimoErro: z.string().nullable(),
  progresso: LattesJobProgressSchema,
});

export const LattesJobsAtivosResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  jobs: z.array(LattesJobResponseSchema),
});

export const EnfileirarDiscoveryRequestSchema = z.object({
  chave: z.string().trim().min(1).max(100),
});

export const EnfileirarDiscoveryResponseSchema = EnfileirarDgpResponseSchema.extend({
  fila: z.literal('discovery'),
});

export const DiscoveryJobEtapaSchema = z.enum([
  'INICIANDO',
  'PREPARANDO_BUSCA',
  'PROCESSANDO_PAGINAS',
  'NORMALIZANDO',
  'CONCLUIDO',
]);

export const DiscoveryJobProgressSchema = z.object({
  etapa: DiscoveryJobEtapaSchema,
  percentual: z.number().int().min(0).max(100).nullable(),
  paginasProcessadas: z.number().int().nonnegative(),
  itensDescobertos: z.number().int().nonnegative(),
  itensPulados: z.number().int().nonnegative(),
  itensComErro: z.number().int().nonnegative(),
  progressoEm: z.iso.datetime(),
});

export const DiscoveryJobResponseSchema = z.object({
  fila: z.literal('discovery'),
  jobId: z.string(),
  chave: z.string(),
  pipelineLogId: z.string().uuid(),
  estado: z.string(),
  worker: z.string().nullable(),
  tentativaAtual: z.number().int().nonnegative(),
  tentativasMaximas: z.number().int().positive(),
  iniciadoEm: z.iso.datetime().nullable(),
  finalizadoEm: z.iso.datetime().nullable(),
  ultimoErro: z.string().nullable(),
  progresso: DiscoveryJobProgressSchema,
});

export const DiscoveryJobsAtivosResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  jobs: z.array(DiscoveryJobResponseSchema),
});

export const EtlGroupJobEtapaSchema = z.enum([
  'LENDO_JSON',
  'VALIDANDO',
  'SALVANDO_GRUPO',
  'SALVANDO_LINHAS',
  'SALVANDO_PESQUISADORES',
  'MOVENDO_ARQUIVO',
  'CONCLUIDO',
]);

export const EtlGroupJobProgressSchema = z.object({
  etapa: EtlGroupJobEtapaSchema,
  percentual: z.number().int().min(0).max(100),
  itensProcessados: z.number().int().nonnegative().nullable(),
  itensTotal: z.number().int().nonnegative().nullable(),
  progressoEm: z.iso.datetime(),
});

export const EtlGroupJobResponseSchema = z.object({
  fila: z.literal('etl-grupos'),
  jobId: z.string(),
  dgpId: z.string(),
  arquivoJson: z.string(),
  pipelineLogId: z.string().uuid(),
  estado: z.string(),
  worker: z.string().nullable(),
  tentativaAtual: z.number().int().nonnegative(),
  tentativasMaximas: z.number().int().positive(),
  iniciadoEm: z.iso.datetime().nullable(),
  finalizadoEm: z.iso.datetime().nullable(),
  ultimoErro: z.string().nullable(),
  progresso: EtlGroupJobProgressSchema,
});

export const EtlGroupJobsAtivosResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  jobs: z.array(EtlGroupJobResponseSchema),
});

export const EtlResearcherJobEtapaSchema = z.enum([
  'LENDO_JSON',
  'VALIDANDO',
  'ENRIQUECENDO_ORCID',
  'ENRIQUECENDO_PRODUCOES',
  'SALVANDO_PESQUISADOR',
  'SALVANDO_PRODUCOES',
  'MOVENDO_ARQUIVO',
  'CONCLUIDO',
]);

export const EtlResearcherJobProgressSchema = z.object({
  etapa: EtlResearcherJobEtapaSchema,
  percentual: z.number().int().min(0).max(100),
  itensProcessados: z.number().int().nonnegative().nullable(),
  itensTotal: z.number().int().nonnegative().nullable(),
  loteAtual: z.number().int().nonnegative().nullable(),
  lotesTotal: z.number().int().nonnegative().nullable(),
  progressoEm: z.iso.datetime(),
});

export const EtlResearcherJobResponseSchema = z.object({
  fila: z.literal('etl-pesquisadores'),
  jobId: z.string(),
  lattesId: z.string(),
  arquivoJson: z.string(),
  pipelineLogId: z.string().uuid(),
  estado: z.string(),
  worker: z.string().nullable(),
  tentativaAtual: z.number().int().nonnegative(),
  tentativasMaximas: z.number().int().positive(),
  iniciadoEm: z.iso.datetime().nullable(),
  finalizadoEm: z.iso.datetime().nullable(),
  ultimoErro: z.string().nullable(),
  progresso: EtlResearcherJobProgressSchema,
});

export const EtlResearcherJobsAtivosResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  jobs: z.array(EtlResearcherJobResponseSchema),
});

export type WorkerFilaResponse = z.infer<typeof WorkerFilaResponseSchema>;
export type WorkersAtivosResponse = z.infer<typeof WorkersAtivosResponseSchema>;
export type EnfileirarDgpRequest = z.infer<typeof EnfileirarDgpRequestSchema>;
export type EnfileirarDgpResponse = z.infer<typeof EnfileirarDgpResponseSchema>;
export type DgpJobEtapa = z.infer<typeof DgpJobEtapaSchema>;
export type DgpJobProgress = z.infer<typeof DgpJobProgressSchema>;
export type DgpJobResponse = z.infer<typeof DgpJobResponseSchema>;
export type DgpJobsAtivosResponse = z.infer<typeof DgpJobsAtivosResponseSchema>;
export type EnfileirarLattesRequest = z.infer<typeof EnfileirarLattesRequestSchema>;
export type EnfileirarLattesResponse = z.infer<typeof EnfileirarLattesResponseSchema>;
export type LattesJobProgress = z.infer<typeof LattesJobProgressSchema>;
export type LattesJobResponse = z.infer<typeof LattesJobResponseSchema>;
export type LattesJobsAtivosResponse = z.infer<typeof LattesJobsAtivosResponseSchema>;
export type EnfileirarDiscoveryRequest = z.infer<typeof EnfileirarDiscoveryRequestSchema>;
export type EnfileirarDiscoveryResponse = z.infer<typeof EnfileirarDiscoveryResponseSchema>;
export type DiscoveryJobProgress = z.infer<typeof DiscoveryJobProgressSchema>;
export type DiscoveryJobResponse = z.infer<typeof DiscoveryJobResponseSchema>;
export type DiscoveryJobsAtivosResponse = z.infer<typeof DiscoveryJobsAtivosResponseSchema>;
export type EtlGroupJobProgress = z.infer<typeof EtlGroupJobProgressSchema>;
export type EtlGroupJobResponse = z.infer<typeof EtlGroupJobResponseSchema>;
export type EtlGroupJobsAtivosResponse = z.infer<typeof EtlGroupJobsAtivosResponseSchema>;
export type EtlResearcherJobProgress = z.infer<typeof EtlResearcherJobProgressSchema>;
export type EtlResearcherJobResponse = z.infer<typeof EtlResearcherJobResponseSchema>;
export type EtlResearcherJobsAtivosResponse = z.infer<typeof EtlResearcherJobsAtivosResponseSchema>;
