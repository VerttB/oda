import {
  ConflictException, Inject, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException,
} from '@nestjs/common';
import {
  createDgpScraperQueue, createDiscoveryQueue, createEtlDispatchQueue, createEtlGroupQueue, createEtlResearcherQueue, createLattesScraperQueue,
  dgpJobId, discoveryJobId, DiscoverDgpGroupsJob,
  enqueueDgpGroup, enqueueDiscoveryKey, enqueueEtlDispatch, enqueueLattesResearcher,
  lattesJobId, QUEUE_NAMES, ScrapeDgpGroupJob, ScrapeLattesResearcherJob,
  validateDiscoverDgpGroupsJob, validateEtlDispatchJob, validateEtlGroupJob, validateEtlResearcherJob,
  validateScrapeDgpGroupJob, validateScrapeLattesResearcherJob,
} from '@oda/queue';
import {
  DgpJobProgress, DgpJobProgressSchema, DgpJobResponse, DgpJobsAtivosResponse,
  DiscoveryJobProgress, DiscoveryJobProgressSchema, DiscoveryJobResponse, DiscoveryJobsAtivosResponse,
  EnfileirarDgpRequest, EnfileirarDgpResponse, EnfileirarDiscoveryRequest, EnfileirarDiscoveryResponse,
  EnfileirarLattesRequest, EnfileirarLattesResponse,
  LattesJobProgress, LattesJobProgressSchema, LattesJobResponse, LattesJobsAtivosResponse,
  EtlGroupJobProgress, EtlGroupJobProgressSchema, EtlGroupJobResponse, EtlGroupJobsAtivosResponse,
  EtlResearcherJobProgress, EtlResearcherJobProgressSchema, EtlResearcherJobResponse, EtlResearcherJobsAtivosResponse,
  WorkerFilaResponse, WorkersAtivosResponse,
  ConsultarFilaJobsRequest, EnfileirarEtlRequest, EnfileirarEtlResponse,
  EtlDispatchJobProgress, EtlDispatchJobProgressSchema, EtlDispatchJobResponse,
  FilaJobsResponse, FilaNome, FilaResumoResponse,
} from '@oda/shared-types';
import { FilaExtracaoStatus, ModuloSistema, ModoExecucao, Prisma, StatusSessao } from '@oda/database';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DGP_QUEUE, DISCOVERY_QUEUE, ETL_DISPATCH_QUEUE, ETL_GROUP_QUEUE, ETL_RESEARCHER_QUEUE, LATTES_QUEUE,
} from './filas.constants';

type DgpQueue = ReturnType<typeof createDgpScraperQueue>;
type LattesQueue = ReturnType<typeof createLattesScraperQueue>;
type DiscoveryQueue = ReturnType<typeof createDiscoveryQueue>;
type EtlGroupQueue = ReturnType<typeof createEtlGroupQueue>;
type EtlResearcherQueue = ReturnType<typeof createEtlResearcherQueue>;
type EtlDispatchQueue = ReturnType<typeof createEtlDispatchQueue>;
type WorkerInfo = Record<string, string>;
type DgpQueueJob = NonNullable<Awaited<ReturnType<DgpQueue['getJob']>>>;
type LattesQueueJob = NonNullable<Awaited<ReturnType<LattesQueue['getJob']>>>;
type DiscoveryQueueJob = NonNullable<Awaited<ReturnType<DiscoveryQueue['getJob']>>>;
type EtlGroupQueueJob = NonNullable<Awaited<ReturnType<EtlGroupQueue['getJob']>>>;
type EtlResearcherQueueJob = NonNullable<Awaited<ReturnType<EtlResearcherQueue['getJob']>>>;
type EtlDispatchQueueJob = NonNullable<Awaited<ReturnType<EtlDispatchQueue['getJob']>>>;
type QueueName = FilaNome;
const JOB_STATES = ['waiting', 'active', 'delayed', 'failed', 'completed', 'paused', 'prioritized', 'waiting-children'] as const;

@Injectable()
export class FilasService implements OnModuleDestroy {
  constructor(
    @Inject(DGP_QUEUE) private readonly dgpQueue: DgpQueue,
    @Inject(LATTES_QUEUE) private readonly lattesQueue: LattesQueue,
    @Inject(DISCOVERY_QUEUE) private readonly discoveryQueue: DiscoveryQueue,
    @Inject(ETL_GROUP_QUEUE) private readonly etlGroupQueue: EtlGroupQueue,
    @Inject(ETL_RESEARCHER_QUEUE) private readonly etlResearcherQueue: EtlResearcherQueue,
    @Inject(ETL_DISPATCH_QUEUE) private readonly etlDispatchQueue: EtlDispatchQueue,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleDestroy() {
    await Promise.all([
      this.dgpQueue.close(), this.lattesQueue.close(), this.discoveryQueue.close(),
      this.etlGroupQueue.close(), this.etlResearcherQueue.close(), this.etlDispatchQueue.close(),
    ]);
  }

  private mapWorker(worker: WorkerInfo, fila: QueueName): WorkerFilaResponse {
    const marker = ':w:';
    const markerIndex = worker.name?.indexOf(marker) ?? -1;
    return {
      id: worker.id || worker.name,
      fila,
      status: 'ATIVO',
      nome: markerIndex >= 0 ? worker.name.slice(markerIndex + marker.length) : null,
      endereco: worker.addr || null,
      conectadoHaSegundos: Number(worker.age || 0),
      conexaoOciosaHaSegundos: Number(worker.idle || 0),
    };
  }

  async findActiveWorkers(): Promise<WorkersAtivosResponse> {
    const [dgp, lattes, discovery, etlGroups, etlResearchers, etlDispatch] = await Promise.all([
      this.dgpQueue.getWorkers(), this.lattesQueue.getWorkers(), this.discoveryQueue.getWorkers(),
      this.etlGroupQueue.getWorkers(), this.etlResearcherQueue.getWorkers(), this.etlDispatchQueue.getWorkers(),
    ]);
    const workers = [
      ...dgp.map(worker => this.mapWorker(worker, 'dgp')),
      ...lattes.map(worker => this.mapWorker(worker, 'lattes')),
      ...discovery.map(worker => this.mapWorker(worker, 'discovery')),
      ...etlGroups.map(worker => this.mapWorker(worker, 'etl-grupos')),
      ...etlResearchers.map(worker => this.mapWorker(worker, 'etl-pesquisadores')),
      ...etlDispatch.map(worker => this.mapWorker(worker, 'etl-despacho')),
    ];
    return { total: workers.length, workers };
  }

  async findWorker(workerId: string): Promise<WorkerFilaResponse> {
    const worker = (await this.findActiveWorkers()).workers.find(item => item.id === workerId);
    if (!worker) throw new NotFoundException(`Worker ${workerId} nao esta ativo nas filas do pipeline.`);
    return worker;
  }

  private progressDate(job: { processedOn?: number; timestamp: number }) {
    return new Date(job.processedOn || job.timestamp).toISOString();
  }

  private normalizeDgpProgress(job: DgpQueueJob, state: string): DgpJobProgress {
    const current = DgpJobProgressSchema.safeParse(job.progress);
    if (current.success) return current.data;
    const legacy = job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
      ? job.progress as Record<string, unknown> : null;
    const parsed = DgpJobProgressSchema.safeParse(legacy ? { ...legacy, progressoEm: legacy.atualizadoEm } : job.progress);
    return parsed.success ? parsed.data : {
      etapa: state === 'completed' ? 'CONCLUIDO' : 'INICIANDO', percentual: state === 'completed' ? 100 : 0,
      itensProcessados: null, itensTotal: null, progressoEm: this.progressDate(job),
    };
  }

  private normalizeLattesProgress(job: LattesQueueJob, state: string): LattesJobProgress {
    const parsed = LattesJobProgressSchema.safeParse(job.progress);
    return parsed.success ? parsed.data : {
      etapa: state === 'completed' ? 'CONCLUIDO' : 'INICIANDO', percentual: state === 'completed' ? 100 : 0,
      paginaAtual: null, paginasTotal: null, progressoEm: this.progressDate(job),
    };
  }

  private normalizeDiscoveryProgress(job: DiscoveryQueueJob, state: string): DiscoveryJobProgress {
    const parsed = DiscoveryJobProgressSchema.safeParse(job.progress);
    return parsed.success ? parsed.data : {
      etapa: state === 'completed' ? 'CONCLUIDO' : 'INICIANDO', percentual: state === 'completed' ? 100 : 0,
      paginasProcessadas: 0, itensDescobertos: 0, itensPulados: 0, itensComErro: 0,
      progressoEm: this.progressDate(job),
    };
  }

  private normalizeEtlGroupProgress(job: EtlGroupQueueJob, state: string): EtlGroupJobProgress {
    const parsed = EtlGroupJobProgressSchema.safeParse(job.progress);
    return parsed.success ? parsed.data : {
      etapa: state === 'completed' ? 'CONCLUIDO' : 'LENDO_JSON',
      percentual: state === 'completed' ? 100 : 0,
      itensProcessados: null, itensTotal: null, progressoEm: this.progressDate(job),
    };
  }

  private normalizeEtlResearcherProgress(job: EtlResearcherQueueJob, state: string): EtlResearcherJobProgress {
    const parsed = EtlResearcherJobProgressSchema.safeParse(job.progress);
    return parsed.success ? parsed.data : {
      etapa: state === 'completed' ? 'CONCLUIDO' : 'LENDO_JSON',
      percentual: state === 'completed' ? 100 : 0,
      itensProcessados: null, itensTotal: null, loteAtual: null, lotesTotal: null,
      progressoEm: this.progressDate(job),
    };
  }

  private normalizeEtlDispatchProgress(job: EtlDispatchQueueJob, state: string): EtlDispatchJobProgress {
    const parsed = EtlDispatchJobProgressSchema.safeParse(job.progress);
    return parsed.success ? parsed.data : {
      etapa: state === 'completed' ? 'CONCLUIDO' : 'INICIANDO',
      percentual: state === 'completed' ? 100 : 0,
      progressoEm: this.progressDate(job),
    };
  }

  private jobRuntime(job: {
    processedBy?: string; attemptsStarted?: number; opts: { attempts?: number };
    processedOn?: number; finishedOn?: number; failedReason?: string;
  }) {
    return {
      worker: job.processedBy || null,
      tentativaAtual: job.attemptsStarted || 0,
      tentativasMaximas: job.opts.attempts || 1,
      iniciadoEm: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finalizadoEm: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      ultimoErro: job.failedReason || null,
    };
  }

  private async mapDgpJob(job: DgpQueueJob): Promise<DgpJobResponse> {
    const state = await job.getState();
    validateScrapeDgpGroupJob(job.data);
    return { fila: 'dgp', jobId: job.id!, dgpId: job.data.dgpId, pipelineLogId: job.data.pipelineLogId,
      estado: state, ...this.jobRuntime(job), progresso: this.normalizeDgpProgress(job, state) };
  }

  private async mapLattesJob(job: LattesQueueJob): Promise<LattesJobResponse> {
    const state = await job.getState();
    validateScrapeLattesResearcherJob(job.data);
    return { fila: 'lattes', jobId: job.id!, lattesId: job.data.lattesId, nome: job.data.nome,
      pipelineLogId: job.data.pipelineLogId, estado: state, ...this.jobRuntime(job),
      progresso: this.normalizeLattesProgress(job, state) };
  }

  private async mapDiscoveryJob(job: DiscoveryQueueJob): Promise<DiscoveryJobResponse> {
    const state = await job.getState();
    validateDiscoverDgpGroupsJob(job.data);
    return { fila: 'discovery', jobId: job.id!, chave: job.data.chave, pipelineLogId: job.data.pipelineLogId,
      estado: state, ...this.jobRuntime(job), progresso: this.normalizeDiscoveryProgress(job, state) };
  }

  private async mapEtlGroupJob(job: EtlGroupQueueJob): Promise<EtlGroupJobResponse> {
    const state = await job.getState();
    validateEtlGroupJob(job.data);
    return {
      fila: 'etl-grupos', jobId: job.id!, dgpId: job.data.dgpId,
      arquivoJson: job.data.arquivoJson, pipelineLogId: job.data.pipelineLogId,
      estado: state, ...this.jobRuntime(job), progresso: this.normalizeEtlGroupProgress(job, state),
    };
  }

  private async mapEtlResearcherJob(job: EtlResearcherQueueJob): Promise<EtlResearcherJobResponse> {
    const state = await job.getState();
    validateEtlResearcherJob(job.data);
    return {
      fila: 'etl-pesquisadores', jobId: job.id!, lattesId: job.data.lattesId,
      arquivoJson: job.data.arquivoJson, pipelineLogId: job.data.pipelineLogId,
      estado: state, ...this.jobRuntime(job), progresso: this.normalizeEtlResearcherProgress(job, state),
    };
  }

  private async mapEtlDispatchJob(job: EtlDispatchQueueJob): Promise<EtlDispatchJobResponse> {
    const state = await job.getState();
    validateEtlDispatchJob(job.data);
    const result = job.returnvalue && typeof job.returnvalue === 'object' ? job.returnvalue : null;
    return {
      fila: 'etl-despacho', jobId: job.id!, requestId: job.data.requestId, tipo: job.data.tipo,
      ids: job.data.ids, escopo: job.data.scope, pipelineLogId: result?.pipelineLogId ?? null,
      estado: state, ...this.jobRuntime(job), progresso: this.normalizeEtlDispatchProgress(job, state),
    };
  }

  async findActiveDgpJobs(): Promise<DgpJobsAtivosResponse> {
    const jobs = await Promise.all((await this.dgpQueue.getJobs(['active'], 0, -1, true)).map(job => this.mapDgpJob(job)));
    return { total: jobs.length, jobs };
  }

  async findDgpJob(jobId: string): Promise<DgpJobResponse> {
    const job = await this.dgpQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} nao foi encontrado na fila DGP.`);
    return this.mapDgpJob(job);
  }

  async findActiveLattesJobs(): Promise<LattesJobsAtivosResponse> {
    const jobs = await Promise.all((await this.lattesQueue.getJobs(['active'], 0, -1, true)).map(job => this.mapLattesJob(job)));
    return { total: jobs.length, jobs };
  }

  async findLattesJob(jobId: string): Promise<LattesJobResponse> {
    const job = await this.lattesQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} nao foi encontrado na fila Lattes.`);
    return this.mapLattesJob(job);
  }

  async findActiveDiscoveryJobs(): Promise<DiscoveryJobsAtivosResponse> {
    const jobs = await Promise.all((await this.discoveryQueue.getJobs(['active'], 0, -1, true)).map(job => this.mapDiscoveryJob(job)));
    return { total: jobs.length, jobs };
  }

  async findDiscoveryJob(jobId: string): Promise<DiscoveryJobResponse> {
    const job = await this.discoveryQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} nao foi encontrado na fila de descoberta.`);
    return this.mapDiscoveryJob(job);
  }

  async findActiveEtlGroupJobs(): Promise<EtlGroupJobsAtivosResponse> {
    const stored = await this.etlGroupQueue.getJobs(['active'], 0, -1, true);
    const jobs = await Promise.all(stored.map(job => this.mapEtlGroupJob(job)));
    return { total: jobs.length, jobs };
  }

  async findEtlGroupJob(jobId: string): Promise<EtlGroupJobResponse> {
    const job = await this.etlGroupQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} nao foi encontrado na fila ETL de grupos.`);
    return this.mapEtlGroupJob(job);
  }

  async findActiveEtlResearcherJobs(): Promise<EtlResearcherJobsAtivosResponse> {
    const stored = await this.etlResearcherQueue.getJobs(['active'], 0, -1, true);
    const jobs = await Promise.all(stored.map(job => this.mapEtlResearcherJob(job)));
    return { total: jobs.length, jobs };
  }

  async findEtlResearcherJob(jobId: string): Promise<EtlResearcherJobResponse> {
    const job = await this.etlResearcherQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} nao foi encontrado na fila ETL de pesquisadores.`);
    return this.mapEtlResearcherJob(job);
  }

  async findEtlDispatchJob(jobId: string): Promise<EtlDispatchJobResponse> {
    const job = await this.etlDispatchQueue.getJob(jobId);
    if (!job) throw new NotFoundException(`Pedido ${jobId} nao foi encontrado na fila de despacho ETL.`);
    return this.mapEtlDispatchJob(job);
  }

  async enqueueEtl(input: EnfileirarEtlRequest): Promise<EnfileirarEtlResponse> {
    const requestId = randomUUID();
    const data = {
      version: 1 as const, requestId, requestedAt: new Date().toISOString(),
      tipo: input.tipo, ids: input.ids, scope: input.escopo,
    };
    let stored: Awaited<ReturnType<typeof enqueueEtlDispatch>>;
    try { stored = await enqueueEtlDispatch(data, this.etlDispatchQueue); }
    catch (error) { throw this.publishError(error); }
    return {
      fila: 'etl-despacho', jobId: stored.id!, requestId, estado: await stored.getState(), duplicado: false,
    };
  }

  private queue(fila: QueueName): any {
    switch (fila) {
      case 'dgp': return this.dgpQueue;
      case 'lattes': return this.lattesQueue;
      case 'discovery': return this.discoveryQueue;
      case 'etl-despacho': return this.etlDispatchQueue;
      case 'etl-grupos': return this.etlGroupQueue;
      case 'etl-pesquisadores': return this.etlResearcherQueue;
    }
  }

  private async counters(queue: any) {
    const counts = await queue.getJobCounts(...JOB_STATES);
    return {
      waiting: counts.waiting || 0, active: counts.active || 0, delayed: counts.delayed || 0,
      failed: counts.failed || 0, completed: counts.completed || 0, paused: counts.paused || 0,
      prioritized: counts.prioritized || 0, waitingChildren: counts['waiting-children'] || 0,
    };
  }

  async findQueue(fila: QueueName): Promise<FilaResumoResponse> {
    const queue = this.queue(fila);
    const [pausada, workers, contadores] = await Promise.all([
      queue.isPaused(), queue.getWorkers(), this.counters(queue),
    ]);
    return { fila, pausada, workersAtivos: workers.length, contadores };
  }

  private mapQueueJob(fila: QueueName, job: any) {
    switch (fila) {
      case 'dgp': return this.mapDgpJob(job);
      case 'lattes': return this.mapLattesJob(job);
      case 'discovery': return this.mapDiscoveryJob(job);
      case 'etl-despacho': return this.mapEtlDispatchJob(job);
      case 'etl-grupos': return this.mapEtlGroupJob(job);
      case 'etl-pesquisadores': return this.mapEtlResearcherJob(job);
    }
  }

  async findQueueJobs(fila: QueueName, query: ConsultarFilaJobsRequest): Promise<FilaJobsResponse> {
    const queue = this.queue(fila);
    const states = query.estado ? [query.estado] : [...JOB_STATES];
    const [stored, pausada, contadores] = await Promise.all([
      queue.getJobs(states, 0, -1, false), queue.isPaused(), this.counters(queue),
    ]);
    let jobs = await Promise.all(stored.map((job: any) => this.mapQueueJob(fila, job)));
    if (query.pipelineLogId) jobs = jobs.filter(job => job.pipelineLogId === query.pipelineLogId);
    jobs.sort((left: any, right: any) => {
      const leftTime = left.iniciadoEm || left.finalizadoEm || '';
      const rightTime = right.iniciadoEm || right.finalizadoEm || '';
      return rightTime.localeCompare(leftTime);
    });
    const total = jobs.length;
    const start = (query.pagina - 1) * query.limite;
    return {
      fila, pausada, total, pagina: query.pagina, limite: query.limite,
      totalPaginas: total ? Math.ceil(total / query.limite) : 0,
      contadores, jobs: jobs.slice(start, start + query.limite),
    };
  }

  async pauseQueue(fila: QueueName): Promise<FilaResumoResponse> {
    await this.queue(fila).pause();
    return this.findQueue(fila);
  }

  async resumeQueue(fila: QueueName): Promise<FilaResumoResponse> {
    await this.queue(fila).resume();
    return this.findQueue(fila);
  }

  private async removeTerminalJob(job: {
    id?: string; data: { pipelineItemId: string }; getState(): Promise<string>; remove(): Promise<void>;
  }) {
    const state = await job.getState();
    if (state !== 'completed' && state !== 'failed') return state;
    const persisted = await this.prisma.pipelineLogItem.findUnique({
      where: { id: job.data.pipelineItemId }, select: { id: true },
    });
    if (!persisted) throw new ConflictException(`O job ${job.id} aguarda reconciliacao antes de uma nova coleta.`);
    await job.remove();
    return null;
  }

  private async confirmPipeline(
    pipeline: { id: string; dataInicio: Date }, initialMetadata: Record<string, unknown>, accepted: boolean, dgpId?: string,
  ) {
    const now = new Date();
    try {
      await this.prisma.pipelineLog.update({
        where: { id: pipeline.id },
        data: accepted ? { metadata: { ...initialMetadata, published: true } as Prisma.InputJsonValue } : {
          ...(dgpId ? { dgpId: null } : {}), status: StatusSessao.CONCLUIDO, dataFim: now,
          duracaoMs: Math.min(now.getTime() - pipeline.dataInicio.getTime(), 2_147_483_647),
          metadata: { ...initialMetadata, jobs: [], published: true, itensFila: 0, itensDuplicados: 1 } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      throw new ServiceUnavailableException(error instanceof Error
        ? `Job publicado, mas a confirmacao do pipeline falhou: ${error.message}`
        : 'Job publicado, mas a confirmacao do pipeline falhou.');
    }
  }

  async enqueueDgp(input: EnfileirarDgpRequest): Promise<EnfileirarDgpResponse> {
    const existing = await this.dgpQueue.getJob(dgpJobId(input.dgpId));
    if (existing) {
      validateScrapeDgpGroupJob(existing.data);
      const state = await this.removeTerminalJob(existing);
      if (state) return { fila: 'dgp', jobId: existing.id!, pipelineLogId: existing.data.pipelineLogId, estado: state, duplicado: true };
    }
    await this.prisma.filaExtracaoGrupo.upsert({
      where: { dgpId: input.dgpId }, update: {},
      create: { dgpId: input.dgpId, nome: `Grupo_${input.dgpId}`, area: 'N/A', instituicao: 'N/A', status: FilaExtracaoStatus.PENDENTE },
    });
    const pipelineLogId = randomUUID();
    const data: ScrapeDgpGroupJob = { version: 1, dgpId: input.dgpId, requestedAt: new Date().toISOString(), pipelineLogId, pipelineItemId: randomUUID() };
    const initialMetadata = { queue: QUEUE_NAMES.DGP_SCRAPER, jobs: [data], published: false, resultados: {}, itensFila: 1 };
    const pipeline = await this.prisma.pipelineLog.create({ data: {
      id: pipelineLogId, modulo: ModuloSistema.SCRAPER, modoExecucao: ModoExecucao.APENAS_DGP,
      dgpId: input.dgpId, metadata: initialMetadata as Prisma.InputJsonValue,
    } });
    let stored: Awaited<ReturnType<typeof enqueueDgpGroup>>;
    try { stored = await enqueueDgpGroup(data, this.dgpQueue); } catch (error) { throw this.publishError(error); }
    const accepted = stored.data.pipelineItemId === data.pipelineItemId;
    await this.confirmPipeline(pipeline, initialMetadata, accepted, input.dgpId);
    return { fila: 'dgp', jobId: stored.id!, pipelineLogId: stored.data.pipelineLogId, estado: await stored.getState(), duplicado: !accepted };
  }

  async enqueueLattes(input: EnfileirarLattesRequest): Promise<EnfileirarLattesResponse> {
    const existing = await this.lattesQueue.getJob(lattesJobId(input.lattesId));
    if (existing) {
      validateScrapeLattesResearcherJob(existing.data);
      const state = await this.removeTerminalJob(existing);
      if (state) return { fila: 'lattes', jobId: existing.id!, pipelineLogId: existing.data.pipelineLogId, estado: state, duplicado: true };
    }
    const researcher = await this.prisma.filaExtracaoPesquisador.findUnique({
      where: { lattesId: input.lattesId }, select: { lattesId: true, nome: true },
    });
    if (!researcher) throw new NotFoundException(`Pesquisador ${input.lattesId} nao existe na fila de extracao.`);
    const pipelineLogId = randomUUID();
    const data: ScrapeLattesResearcherJob = { version: 1, ...researcher, requestedAt: new Date().toISOString(), pipelineLogId, pipelineItemId: randomUUID() };
    const initialMetadata = { queue: QUEUE_NAMES.LATTES_SCRAPER, jobs: [data], published: false, resultados: {}, itensFila: 1 };
    const pipeline = await this.prisma.pipelineLog.create({ data: {
      id: pipelineLogId, modulo: ModuloSistema.SCRAPER, modoExecucao: ModoExecucao.APENAS_LATTES,
      metadata: initialMetadata as Prisma.InputJsonValue,
    } });
    let stored: Awaited<ReturnType<typeof enqueueLattesResearcher>>;
    try { stored = await enqueueLattesResearcher(data, this.lattesQueue); } catch (error) { throw this.publishError(error); }
    const accepted = stored.data.pipelineItemId === data.pipelineItemId;
    await this.confirmPipeline(pipeline, initialMetadata, accepted);
    return { fila: 'lattes', jobId: stored.id!, pipelineLogId: stored.data.pipelineLogId, estado: await stored.getState(), duplicado: !accepted };
  }

  async enqueueDiscovery(input: EnfileirarDiscoveryRequest): Promise<EnfileirarDiscoveryResponse> {
    const existing = await this.discoveryQueue.getJob(discoveryJobId(input.chave));
    if (existing) {
      validateDiscoverDgpGroupsJob(existing.data);
      const state = await this.removeTerminalJob(existing);
      if (state) return { fila: 'discovery', jobId: existing.id!, pipelineLogId: existing.data.pipelineLogId, estado: state, duplicado: true };
    }
    const pipelineLogId = randomUUID();
    const data: DiscoverDgpGroupsJob = { version: 1, chave: input.chave.trim(), requestedAt: new Date().toISOString(), pipelineLogId, pipelineItemId: randomUUID() };
    const initialMetadata = { queue: QUEUE_NAMES.DGP_DISCOVERY, jobs: [data], published: false, resultados: {}, itensFila: 1 };
    const pipeline = await this.prisma.pipelineLog.create({ data: {
      id: pipelineLogId, modulo: ModuloSistema.SCRAPER, modoExecucao: ModoExecucao.APENAS_DGP,
      metadata: initialMetadata as Prisma.InputJsonValue,
    } });
    let stored: Awaited<ReturnType<typeof enqueueDiscoveryKey>>;
    try { stored = await enqueueDiscoveryKey(data, this.discoveryQueue); } catch (error) { throw this.publishError(error); }
    const accepted = stored.data.pipelineItemId === data.pipelineItemId;
    await this.confirmPipeline(pipeline, initialMetadata, accepted);
    return { fila: 'discovery', jobId: stored.id!, pipelineLogId: stored.data.pipelineLogId, estado: await stored.getState(), duplicado: !accepted };
  }

  private publishError(error: unknown) {
    return new ServiceUnavailableException(error instanceof Error
      ? `Nao foi possivel publicar no Redis: ${error.message}` : 'Nao foi possivel publicar no Redis.');
  }
}
