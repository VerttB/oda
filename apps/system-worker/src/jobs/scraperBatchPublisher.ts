import { randomUUID } from 'node:crypto';
import type { Job, Queue } from 'bullmq';
import {
  ModuloSistema, ModoExecucao, Prisma, PrismaClient,
  StatusItemLog, StatusSessao,
} from '@oda/database';
import type { ScrapeDgpGroupJob, ScrapeLattesResearcherJob } from '@oda/queue';

type ScraperJob = ScrapeDgpGroupJob | ScrapeLattesResearcherJob;
type BatchMetadata<T extends ScraperJob> = {
  queue: string;
  jobs: T[];
  published: boolean;
  resultados: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

export async function selectAvailable<T extends { id: string }, J extends ScraperJob>(options: {
  queue: Queue<J>;
  prisma: PrismaClient;
  limit: number;
  page: (after: string | undefined, size: number) => Promise<T[]>;
  eligible: (row: T) => boolean;
  jobId: (id: string) => string;
  validate: (data: unknown) => void;
}): Promise<T[]> {
  const available: T[] = [];
  let after: string | undefined;
  const pageSize = 200;

  for (;;) {
    const rows = await options.page(after, pageSize);
    if (!rows.length) break;
    after = rows[rows.length - 1]!.id;

    for (const row of rows) {
      if (!options.eligible(row)) continue;
      const existing = await options.queue.getJob(options.jobId(row.id));
      if (existing) {
        const state = await existing.getState();
        if (state !== 'completed' && state !== 'failed') continue;
        options.validate(existing.data);
        const settled = await options.prisma.pipelineLogItem.findUnique({ where: { id: existing.data.pipelineItemId } });
        if (!settled) continue;
        await existing.remove();
      }
      available.push(row);
      if (available.length >= options.limit) return available;
    }
    if (rows.length < pageSize) break;
  }
  return available;
}

export async function publishScraperBatch<TTarget, T extends ScraperJob>(options: {
  prisma: PrismaClient;
  queueName: string;
  mode: ModoExecucao;
  targets: TTarget[];
  scope?: string;
  createJob: (target: TTarget, manifest: {
    version: 1; requestedAt: string; pipelineLogId: string; pipelineItemId: string;
  }) => T;
  enqueue: (data: T) => Promise<Job<T>>;
}): Promise<{ pipelineLogId: string | null; enqueued: number; duplicates: number }> {
  if (!options.targets.length) return { pipelineLogId: null, enqueued: 0, duplicates: 0 };

  const pipelineLogId = randomUUID();
  const jobs = options.targets.map(target => options.createJob(target, {
    version: 1,
    requestedAt: new Date().toISOString(),
    pipelineLogId,
    pipelineItemId: randomUUID(),
  }));
  const initial: BatchMetadata<T> = {
    queue: options.queueName,
    jobs,
    published: false,
    resultados: {},
    itensFila: jobs.length,
    ...(options.scope ? { scope: options.scope } : {}),
  };
  await options.prisma.pipelineLog.create({ data: {
    id: pipelineLogId,
    modulo: ModuloSistema.SCRAPER,
    modoExecucao: options.mode,
    dgpId: jobs.length === 1 && 'dgpId' in jobs[0]! ? String(jobs[0]!.dgpId) : null,
    metadata: initial as unknown as Prisma.InputJsonValue,
  } });

  const accepted: T[] = [];
  for (const data of jobs) {
    const stored = await options.enqueue(data);
    if (stored.data.pipelineItemId === data.pipelineItemId) accepted.push(data);
  }

  await options.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM pipeline_log WHERE id = ${pipelineLogId} FOR UPDATE`;
    const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id: pipelineLogId } });
    const meta = row.metadata as unknown as BatchMetadata<T>;
    if (meta.published) return;
    meta.jobs = accepted;
    meta.published = true;
    meta['itensDuplicados'] = jobs.length - accepted.length;
    meta['itensFila'] = accepted.length;

    const items = await tx.pipelineLogItem.findMany({ where: { pipelineLogId } });
    const successes = items.filter(item => item.status === StatusItemLog.SUCESSO).length;
    const errors = items.filter(item => item.status === StatusItemLog.ERRO).length;
    const finished = successes + errors === accepted.length;
    const now = new Date();
    if (options.mode === ModoExecucao.APENAS_DGP) {
      const results = Object.values(meta.resultados);
      for (const key of ['tamanhoTotalBytes', 'membrosExtraidos', 'linhasExtraidas', 'instituicoesExtraidas', 'pesquisadoresEnfileirados']) {
        meta[key] = results.reduce((sum, result) => sum + Number(result[key] || 0), 0);
      }
      Object.assign(meta, { gruposExtraidos: successes, itensComErro: errors, arquivosJsonGerados: successes,
        gruposPendentes: accepted.length - successes - errors });
    } else {
      const results = Object.values(meta.resultados);
      Object.assign(meta, {
        pesquisadoresExtraidos: successes,
        pesquisadoresComErro: errors,
        pesquisadoresPendentes: accepted.length - successes - errors,
        arquivosJsonGerados: successes,
        tamanhoTotalBytes: results.reduce((sum, result) => sum + Number(result['tamanhoTotalBytes'] || 0), 0),
        producoesExtraidas: results.reduce((sum, result) => sum + Number(result['producoesExtraidas'] || 0), 0),
      });
    }
    await tx.pipelineLog.update({ where: { id: pipelineLogId }, data: {
      metadata: meta as unknown as Prisma.InputJsonValue,
      registrosProcessados: successes + errors,
      quantidadeSucessos: successes,
      quantidadeErros: errors,
      status: finished ? (errors ? StatusSessao.ERRO : StatusSessao.CONCLUIDO) : StatusSessao.EMANDAMENTO,
      dataFim: finished ? now : null,
      duracaoMs: finished ? Math.min(now.getTime() - row.dataInicio.getTime(), 2147483647) : null,
    } });
  }, { maxWait: 15000, timeout: 15000 });

  return { pipelineLogId, enqueued: accepted.length, duplicates: jobs.length - accepted.length };
}
