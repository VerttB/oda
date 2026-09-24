import { Queue } from 'bullmq';
import { createQueueConnection } from './connection';
import {
  DGP_QUEUE_SETTINGS,
  DISCOVERY_QUEUE_SETTINGS,
  DiscoverDgpGroupsJob,
  DiscoverDgpGroupsResult,
  JOB_NAMES,
  LATTES_QUEUE_SETTINGS,
  QUEUE_NAMES,
  ScrapeDgpGroupJob,
  ScrapeDgpGroupResult,
  ScrapeLattesResearcherJob,
  ScrapeLattesResearcherResult,
  dgpJobId,
  discoveryJobId,
  lattesJobId,
  validateDiscoverDgpGroupsJob,
  validateScrapeDgpGroupJob,
  validateScrapeLattesResearcherJob,
  ETL_GROUP_QUEUE_SETTINGS,
  ETL_RESEARCHER_QUEUE_SETTINGS,
  EtlGroupJob,
  EtlGroupResult,
  EtlResearcherJob,
  EtlResearcherResult,
  etlGroupJobId,
  etlResearcherJobId,
  validateEtlGroupJob,
  validateEtlResearcherJob,
  ETL_DISPATCH_QUEUE_SETTINGS,
  EtlDispatchJob,
  EtlDispatchResult,
  etlDispatchJobId,
  validateEtlDispatchJob,
} from './contracts';

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

function defaultJobOptions(attempts: number, retryDelayMs: number) {
  return {
    attempts,
    backoff: { type: 'exponential' as const, delay: retryDelayMs },
    removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
    removeOnFail: false,
  };
}

export function createLattesScraperQueue() {
  return new Queue<ScrapeLattesResearcherJob, ScrapeLattesResearcherResult>(QUEUE_NAMES.LATTES_SCRAPER, {
    connection: createQueueConnection('producer'),
    defaultJobOptions: defaultJobOptions(LATTES_QUEUE_SETTINGS.attempts, LATTES_QUEUE_SETTINGS.retryDelayMs),
  });
}

export async function enqueueLattesResearcher(
  data: ScrapeLattesResearcherJob,
  queue: ReturnType<typeof createLattesScraperQueue>,
) {
  validateScrapeLattesResearcherJob(data);
  const id = lattesJobId(data.lattesId);
  await queue.add(JOB_NAMES.SCRAPE_LATTES_RESEARCHER, data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}

export function createDiscoveryQueue() {
  return new Queue<DiscoverDgpGroupsJob, DiscoverDgpGroupsResult>(QUEUE_NAMES.DGP_DISCOVERY, {
    connection: createQueueConnection('producer'),
    defaultJobOptions: defaultJobOptions(DISCOVERY_QUEUE_SETTINGS.attempts, DISCOVERY_QUEUE_SETTINGS.retryDelayMs),
  });
}

export async function enqueueDiscoveryKey(data: DiscoverDgpGroupsJob, queue: ReturnType<typeof createDiscoveryQueue>) {
  validateDiscoverDgpGroupsJob(data);
  const id = discoveryJobId(data.chave);
  await queue.add(JOB_NAMES.DISCOVER_DGP_GROUPS, data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}

export function createEtlGroupQueue() {
  return new Queue<EtlGroupJob, EtlGroupResult>(QUEUE_NAMES.ETL_GROUPS, {
    connection: createQueueConnection('producer'),
    defaultJobOptions: defaultJobOptions(ETL_GROUP_QUEUE_SETTINGS.attempts, ETL_GROUP_QUEUE_SETTINGS.retryDelayMs),
  });
}

export async function enqueueEtlGroup(data: EtlGroupJob, queue: ReturnType<typeof createEtlGroupQueue>) {
  validateEtlGroupJob(data);
  const id = etlGroupJobId(data.dgpId);
  await queue.add(JOB_NAMES.ETL_GROUP, data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}

export function createEtlResearcherQueue() {
  return new Queue<EtlResearcherJob, EtlResearcherResult>(QUEUE_NAMES.ETL_RESEARCHERS, {
    connection: createQueueConnection('producer'),
    defaultJobOptions: defaultJobOptions(ETL_RESEARCHER_QUEUE_SETTINGS.attempts, ETL_RESEARCHER_QUEUE_SETTINGS.retryDelayMs),
  });
}

export async function enqueueEtlResearcher(data: EtlResearcherJob, queue: ReturnType<typeof createEtlResearcherQueue>) {
  validateEtlResearcherJob(data);
  const id = etlResearcherJobId(data.lattesId);
  await queue.add(JOB_NAMES.ETL_RESEARCHER, data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}

export function createEtlDispatchQueue() {
  return new Queue<EtlDispatchJob, EtlDispatchResult>(QUEUE_NAMES.ETL_DISPATCH, {
    connection: createQueueConnection('producer'),
    defaultJobOptions: defaultJobOptions(ETL_DISPATCH_QUEUE_SETTINGS.attempts, ETL_DISPATCH_QUEUE_SETTINGS.retryDelayMs),
  });
}

export async function enqueueEtlDispatch(data: EtlDispatchJob, queue: ReturnType<typeof createEtlDispatchQueue>) {
  validateEtlDispatchJob(data);
  const id = etlDispatchJobId(data.requestId);
  await queue.add(JOB_NAMES.ETL_DISPATCH, data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}
