import { z } from 'zod';

export const FilaNomeSchema = z.enum(['dgp', 'lattes', 'discovery', 'etl-despacho', 'etl-grupos', 'etl-pesquisadores', 'system-maintenance']);
export const WorkerStatusSchema = z.enum(['ATIVO']);
export const CnpqIdSchema = z.string().trim().regex(/^\d{16}$/, 'O ID deve conter exatamente 16 digitos');

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
  dgpId: CnpqIdSchema,
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
  lattesId: CnpqIdSchema,
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

export const UfBrasilSchema = z.enum([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export const RegiaoBrasilSchema = z.enum(['NORTE', 'NORDESTE', 'CENTRO_OESTE', 'SUDESTE', 'SUL']);

export const EnfileirarDiscoveryRequestSchema = z.object({
  chave: z.string().trim().min(1).max(100),
  uf: UfBrasilSchema.default('BA'),
});

export const EnfileirarDiscoveryResponseSchema = EnfileirarDgpResponseSchema.extend({
  fila: z.literal('discovery'),
  uf: UfBrasilSchema,
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
  uf: UfBrasilSchema,
  regiao: RegiaoBrasilSchema,
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

export const EnfileirarEtlRequestSchema = z.object({
  tipo: z.enum(['TODOS', 'GRUPOS', 'PESQUISADORES']).default('TODOS'),
  ids: z.array(CnpqIdSchema).max(500).default([]).transform(ids => [...new Set(ids)]),
  escopo: z.enum(['default', 'simcc']).default('default'),
}).superRefine((value, context) => {
  if (value.escopo === 'simcc' && value.tipo !== 'GRUPOS') {
    context.addIssue({ code: 'custom', path: ['tipo'], message: 'O escopo SIMCC aceita somente ETL de grupos' });
  }
  if (value.tipo === 'TODOS' && value.ids.length) {
    context.addIssue({ code: 'custom', path: ['ids'], message: 'IDs explicitos exigem GRUPOS ou PESQUISADORES' });
  }
});

export const EnfileirarEtlResponseSchema = z.object({
  fila: z.literal('etl-despacho'),
  jobId: z.string(),
  requestId: z.string().uuid(),
  estado: z.string(),
  duplicado: z.boolean(),
});

export const EtlDispatchJobProgressSchema = z.object({
  etapa: z.enum(['INICIANDO', 'LENDO_ARQUIVOS', 'CRIANDO_LOTE', 'PUBLICANDO', 'CONCLUIDO']),
  percentual: z.number().int().min(0).max(100),
  progressoEm: z.iso.datetime(),
});

export const EtlDispatchJobResponseSchema = z.object({
  fila: z.literal('etl-despacho'),
  jobId: z.string(),
  requestId: z.string().uuid(),
  tipo: z.enum(['TODOS', 'GRUPOS', 'PESQUISADORES']),
  ids: z.array(CnpqIdSchema),
  escopo: z.enum(['default', 'simcc']),
  pipelineLogId: z.string().uuid().nullable(),
  estado: z.string(),
  worker: z.string().nullable(),
  tentativaAtual: z.number().int().nonnegative(),
  tentativasMaximas: z.number().int().positive(),
  iniciadoEm: z.iso.datetime().nullable(),
  finalizadoEm: z.iso.datetime().nullable(),
  ultimoErro: z.string().nullable(),
  progresso: EtlDispatchJobProgressSchema,
});

export const FilaEstadoJobSchema = z.enum([
  'waiting', 'active', 'delayed', 'failed', 'completed', 'paused', 'prioritized', 'waiting-children',
]);

export const ConsultarFilaJobsRequestSchema = z.object({
  estado: FilaEstadoJobSchema.optional(),
  pipelineLogId: z.string().uuid().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(25),
});

export const FilaParamSchema = z.object({ fila: FilaNomeSchema });

export const FilaContadoresSchema = z.object({
  waiting: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  paused: z.number().int().nonnegative(),
  prioritized: z.number().int().nonnegative(),
  waitingChildren: z.number().int().nonnegative(),
});

export const FilaResumoResponseSchema = z.object({
  fila: FilaNomeSchema,
  pausada: z.boolean(),
  workersAtivos: z.number().int().nonnegative(),
  contadores: FilaContadoresSchema,
});

export const FilaJobResponseSchema = z.discriminatedUnion('fila', [
  DgpJobResponseSchema,
  LattesJobResponseSchema,
  DiscoveryJobResponseSchema,
  EtlDispatchJobResponseSchema,
  EtlGroupJobResponseSchema,
  EtlResearcherJobResponseSchema,
]);

export const FilaJobsResponseSchema = z.object({
  fila: FilaNomeSchema,
  pausada: z.boolean(),
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  limite: z.number().int().positive(),
  totalPaginas: z.number().int().nonnegative(),
  contadores: FilaContadoresSchema,
  jobs: z.array(FilaJobResponseSchema),
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
export type EnfileirarEtlRequest = z.infer<typeof EnfileirarEtlRequestSchema>;
export type EnfileirarEtlResponse = z.infer<typeof EnfileirarEtlResponseSchema>;
export type EtlDispatchJobProgress = z.infer<typeof EtlDispatchJobProgressSchema>;
export type EtlDispatchJobResponse = z.infer<typeof EtlDispatchJobResponseSchema>;
export type FilaNome = z.infer<typeof FilaNomeSchema>;
export type ConsultarFilaJobsRequest = z.infer<typeof ConsultarFilaJobsRequestSchema>;
export type FilaResumoResponse = z.infer<typeof FilaResumoResponseSchema>;
export type FilaJobsResponse = z.infer<typeof FilaJobsResponseSchema>;

// ==========================================
// SYSTEM MAINTENANCE JOBS
// ==========================================

export const SystemMaintenanceJobNameSchema = z.enum([
  'backup-database',
  'refresh-materialized-view',
  'cleanup-old-logs',
  'reconcile-stuck-queues',
  'enqueue-etl',
  'enqueue-dgp-scraper',
  'enqueue-lattes-scraper',
]);

export const EnfileirarBackupDbRequestSchema = z.object({
  format: z.enum(['plain', 'custom']).default('custom'),
  retentionDays: z.coerce.number().int().positive().default(7),
});

export const EnfileirarBackupDbResponseSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: z.literal('backup-database'),
  status: z.string(),
  duplicado: z.boolean(),
});

export const EnfileirarRefreshMvRequestSchema = z.object({
  concurrently: z.boolean().default(true),
});

export const EnfileirarRefreshMvResponseSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: z.literal('refresh-materialized-view'),
  status: z.string(),
  duplicado: z.boolean(),
});

export const EnfileirarCleanupLogsRequestSchema = z.object({
  retentionDays: z.coerce.number().int().positive().default(30),
});

export const EnfileirarCleanupLogsResponseSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: z.literal('cleanup-old-logs'),
  status: z.string(),
  duplicado: z.boolean(),
});

export const EnfileirarReconcileStuckQueuesRequestSchema = z.object({
  staleDays: z.coerce.number().int().positive().default(14),
});

export const EnfileirarReconcileStuckQueuesResponseSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: z.literal('reconcile-stuck-queues'),
  status: z.string(),
  duplicado: z.boolean(),
});

export const EnfileirarEnqueueEtlRequestSchema = z.object({
  tipo: z.enum(['TODOS', 'GRUPOS', 'PESQUISADORES']).default('TODOS'),
  escopo: z.enum(['default', 'simcc']).default('default'),
});

export const EnfileirarEnqueueEtlResponseSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: z.literal('enqueue-etl'),
  status: z.string(),
  duplicado: z.boolean(),
});

export const EnfileirarEnqueueDgpScraperRequestSchema = z.object({
  scope: z.enum(['default', 'simcc']).default('default'),
});

export const EnfileirarEnqueueDgpScraperResponseSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: z.literal('enqueue-dgp-scraper'),
  status: z.string(),
  duplicado: z.boolean(),
});

export const EnfileirarEnqueueLattesScraperRequestSchema = z.object({
  lattesId: CnpqIdSchema.optional(),
});

export const EnfileirarEnqueueLattesScraperResponseSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: z.literal('enqueue-lattes-scraper'),
  status: z.string(),
  duplicado: z.boolean(),
});

export const SystemMaintenanceJobStatusSchema = z.object({
  fila: z.literal('system-maintenance'),
  jobId: z.string(),
  jobName: SystemMaintenanceJobNameSchema,
  status: z.string(),
  progresso: z.number().int().min(0).max(100).nullable(),
  iniciadoEm: z.iso.datetime().nullable(),
  finalizadoEm: z.iso.datetime().nullable(),
  ultimoErro: z.string().nullable(),
  resultado: z.unknown().nullable(),
});

export const SystemMaintenanceJobsAtivosResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  jobs: z.array(z.any()), // Will be replaced with discriminated union later
});

// Types
export type SystemMaintenanceJobName = z.infer<typeof SystemMaintenanceJobNameSchema>;
export type EnfileirarBackupDbRequest = z.infer<typeof EnfileirarBackupDbRequestSchema>;
export type EnfileirarBackupDbResponse = z.infer<typeof EnfileirarBackupDbResponseSchema>;
export type EnfileirarRefreshMvRequest = z.infer<typeof EnfileirarRefreshMvRequestSchema>;
export type EnfileirarRefreshMvResponse = z.infer<typeof EnfileirarRefreshMvResponseSchema>;
export type EnfileirarCleanupLogsRequest = z.infer<typeof EnfileirarCleanupLogsRequestSchema>;
export type EnfileirarCleanupLogsResponse = z.infer<typeof EnfileirarCleanupLogsResponseSchema>;
export type EnfileirarReconcileStuckQueuesRequest = z.infer<typeof EnfileirarReconcileStuckQueuesRequestSchema>;
export type EnfileirarReconcileStuckQueuesResponse = z.infer<typeof EnfileirarReconcileStuckQueuesResponseSchema>;
export type EnfileirarEnqueueEtlRequest = z.infer<typeof EnfileirarEnqueueEtlRequestSchema>;
export type EnfileirarEnqueueEtlResponse = z.infer<typeof EnfileirarEnqueueEtlResponseSchema>;
export type EnfileirarEnqueueDgpScraperRequest = z.infer<typeof EnfileirarEnqueueDgpScraperRequestSchema>;
export type EnfileirarEnqueueDgpScraperResponse = z.infer<typeof EnfileirarEnqueueDgpScraperResponseSchema>;
export type EnfileirarEnqueueLattesScraperRequest = z.infer<typeof EnfileirarEnqueueLattesScraperRequestSchema>;
export type EnfileirarEnqueueLattesScraperResponse = z.infer<typeof EnfileirarEnqueueLattesScraperResponseSchema>;
export type SystemMaintenanceJobStatus = z.infer<typeof SystemMaintenanceJobStatusSchema>;
export type SystemMaintenanceJobsAtivosResponse = z.infer<typeof SystemMaintenanceJobsAtivosResponseSchema>;
