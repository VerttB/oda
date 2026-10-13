import type { Job } from 'bullmq';
import { FilaExtracaoStatus, ModuloSistema, ModoExecucao, StatusSessao } from '@oda/database';
import {
  createLattesScraperQueue, enqueueLattesResearcher, lattesJobId,
  QUEUE_NAMES, SCRAPER_ENQUEUE_LIMITS, validateScrapeLattesResearcherJob,
  type EnqueueLattesScraperJob,
} from '@oda/queue';
import { prisma } from '../common/database';
import { publishScraperBatch, selectAvailable } from './scraperBatchPublisher';

export async function handleEnqueueLattesScraperJob(job: Job<EnqueueLattesScraperJob>) {
  const requestedId = job.data.lattesId;
  if (requestedId && !/^\d{16}$/.test(requestedId)) throw new Error('O lattesId deve conter exatamente 16 digitos.');
  const queue = createLattesScraperQueue();
  try {
    const targets = await selectAvailable({
      queue,
      prisma,
      limit: requestedId ? 1 : SCRAPER_ENQUEUE_LIMITS.lattes,
      page: async (after, size) => {
        if (requestedId && after) return [];
        const rows = await prisma.filaExtracaoPesquisador.findMany({
          where: requestedId
            ? { lattesId: requestedId }
            : { status: FilaExtracaoStatus.PENDENTE, ...(after ? { lattesId: { gt: after } } : {}) },
          select: { lattesId: true, nome: true },
          orderBy: { lattesId: 'asc' },
          take: requestedId ? 1 : size,
        });
        return rows.map(row => ({ ...row, id: row.lattesId }));
      },
      eligible: row => /^\d{16}$/.test(row.id) && Boolean(row.nome.trim()),
      jobId: lattesJobId,
      validate: validateScrapeLattesResearcherJob,
    });
    if (requestedId && !targets.length) {
      const exists = await prisma.filaExtracaoPesquisador.findUnique({ where: { lattesId: requestedId } });
      if (!exists) throw new Error(`Pesquisador ${requestedId} inexistente na fila SQL.`);
    }
    if (targets.length) {
      const legacyPipeline = await prisma.pipelineLog.findFirst({
        where: {
          modulo: ModuloSistema.SCRAPER,
          modoExecucao: ModoExecucao.APENAS_LATTES,
          status: StatusSessao.EMANDAMENTO,
          atualizadoEm: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
          metadata: { path: ['comando'], equals: 'lattes-scraper' },
        },
        select: { id: true },
      });
      if (legacyPipeline) throw new Error('O scraper Lattes tradicional esta em andamento. Aguarde sua conclusao antes de publicar jobs BullMQ.');
    }
    const result = await publishScraperBatch({
      prisma,
      queueName: QUEUE_NAMES.LATTES_SCRAPER,
      mode: ModoExecucao.APENAS_LATTES,
      targets,
      createJob: (target, manifest) => ({ ...manifest, lattesId: target.lattesId, nome: target.nome }),
      enqueue: data => enqueueLattesResearcher(data, queue),
    });
    console.log('[System Worker] Pesquisadores Lattes publicados.', result);
    return { success: true, ...result };
  } finally {
    await queue.close();
  }
}
