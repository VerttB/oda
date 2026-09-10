import { Queue } from 'bullmq';
import { createQueueConnection } from './connection';
import { DGP_QUEUE_SETTINGS, JOB_NAMES, QUEUE_NAMES, ScrapeDgpGroupJob, ScrapeDgpGroupResult, validateScrapeDgpGroupJob, dgpJobId } from './contracts';

export function createDgpScraperQueue() {
  return new Queue<ScrapeDgpGroupJob, ScrapeDgpGroupResult>(QUEUE_NAMES.DGP_SCRAPER, {
    connection: createQueueConnection('producer'),
    defaultJobOptions: {
      attempts: DGP_QUEUE_SETTINGS.attempts,
      backoff: { type: 'exponential', delay: DGP_QUEUE_SETTINGS.retryDelayMs },
      removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
      // Falhas permanecem disponiveis ate a reconciliacao com o PostgreSQL.
      removeOnFail: false,
    },
  });
}

export async function enqueueDgpGroup(data: ScrapeDgpGroupJob, queue: ReturnType<typeof createDgpScraperQueue>) {
  validateScrapeDgpGroupJob(data);
  const id = dgpJobId(data.dgpId);
  await queue.add(JOB_NAMES.SCRAPE_DGP_GROUP, data, { jobId: id });
  // Em duplicatas, o objeto retornado por add pode conter os dados enviados agora.
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}
