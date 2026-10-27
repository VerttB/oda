import type { Job } from 'bullmq';
import { FilaExtracaoStatus, ModoExecucao } from '@oda/database';
import {
  createDgpScraperQueue, dgpJobId, enqueueDgpGroup, parseDataScope,
  SCRAPER_ENQUEUE_LIMITS, validateScrapeDgpGroupJob,
  type EnqueueDgpScraperJob, type ScrapeDgpGroupJob,
} from '@oda/queue';
import { isSimccInstitution } from '@oda/shared-types';
import { prisma } from '../common/database';
import { publishScraperBatch, selectAvailable } from './scraperBatchPublisher';

export async function handleEnqueueDgpScraperJob(job: Job<EnqueueDgpScraperJob>) {
  const scope = parseDataScope(job.data.scope ?? 'default');
  const queue = createDgpScraperQueue(scope);
  try {
    const targets = await selectAvailable({
      queue,
      prisma,
      limit: scope === 'simcc' ? Infinity : SCRAPER_ENQUEUE_LIMITS.dgp,
      page: async (after, size) => {
        const rows = await prisma.filaExtracaoGrupo.findMany({
          where: {
            ...(scope === 'default' ? { status: FilaExtracaoStatus.PENDENTE } : {}),
            ...(after ? { dgpId: { gt: after } } : {}),
          },
          select: { dgpId: true, instituicao: true },
          orderBy: { dgpId: 'asc' },
          take: size,
        });
        return rows.map(row => ({ ...row, id: row.dgpId }));
      },
      eligible: row => /^\d{16}$/.test(row.id) && (scope !== 'simcc' || isSimccInstitution(row.instituicao)),
      jobId: dgpJobId,
      validate: validateScrapeDgpGroupJob,
    });
    const result = await publishScraperBatch({
      prisma,
      queueName: queue.name,
      mode: ModoExecucao.APENAS_DGP,
      scope,
      targets,
      createJob: (target, manifest): ScrapeDgpGroupJob => ({ ...manifest, dgpId: target.dgpId, scope }),
      enqueue: data => enqueueDgpGroup(data, queue),
    });
    console.log('[System Worker] Grupos DGP publicados.', { scope, ...result });
    return { success: true, ...result };
  } finally {
    await queue.close();
  }
}
