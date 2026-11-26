import type { Job } from 'bullmq';
import { FilaExtracaoStatus, findRegionalCimatecDgpIds, ModoExecucao } from '@oda/database';
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
  const scheduledSimcc = scope === 'simcc' && job.data.limite !== undefined;
  const limit = job.data.limite ?? (scope === 'simcc' ? Infinity : SCRAPER_ENQUEUE_LIMITS.dgp);
  if (!(limit === Infinity || (Number.isSafeInteger(limit) && limit > 0 && limit <= 300))) {
    throw new Error('Limite DGP deve ser um inteiro entre 1 e 300.');
  }
  const queue = createDgpScraperQueue(scope);
  try {
    const regionalCimatecIds = scope === 'simcc' ? await findRegionalCimatecDgpIds(prisma) : undefined;
    const targets = await selectAvailable({
      queue,
      prisma,
      limit,
      page: async (after, size) => {
        const rows = await prisma.filaExtracaoGrupo.findMany({
          where: {
            ...(scope === 'default' ? { status: FilaExtracaoStatus.PENDENTE } : {}),
            ...(scheduledSimcc ? { status: { not: FilaExtracaoStatus.PROCESSANDO } } : {}),
            ...(after && !scheduledSimcc ? { dgpId: { gt: after } } : {}),
          },
          select: { dgpId: true, instituicao: true },
          orderBy: scheduledSimcc ? [{ ultimaAtualizacao: 'asc' }, { dgpId: 'asc' }] : { dgpId: 'asc' },
          ...(after && scheduledSimcc ? { cursor: { dgpId: after }, skip: 1 } : {}),
          take: size,
        });
        return rows.map(row => ({ ...row, id: row.dgpId }));
      },
      eligible: row => /^\d{16}$/.test(row.id) &&
        (scope !== 'simcc' || isSimccInstitution(row.instituicao, regionalCimatecIds?.has(row.id))),
      jobId: dgpJobId,
      validate: validateScrapeDgpGroupJob,
    });
    const result = await publishScraperBatch({
      prisma,
      queueName: queue.name,
      mode: ModoExecucao.APENAS_DGP,
      scope,
      simccAutoEtl: scheduledSimcc,
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
