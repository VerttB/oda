import {
    createEtlGroupQueue, createEtlResearcherQueue, enqueueEtlGroup, enqueueEtlResearcher,
    EtlGroupJob, EtlResearcherJob, etlGroupJobId, etlResearcherJobId,
} from '@oda/queue';
import { EtlBatch, EtlQueueRepository } from './etlRepository';

type GroupQueue = ReturnType<typeof createEtlGroupQueue>;
type ResearcherQueue = ReturnType<typeof createEtlResearcherQueue>;
type RedisJob<T> = {
    data: T;
    failedReason?: string;
    attemptsMade: number;
    getState(): Promise<string>;
};

async function publishGroups(batch: EtlBatch, queue: GroupQueue, repository: EtlQueueRepository) {
    const accepted: EtlGroupJob[] = [];
    for (const data of batch.groupJobs) {
        if (await repository.result(data)) { accepted.push(data); continue; }
        const stored = await enqueueEtlGroup(data, queue);
        if (stored.data.pipelineItemId === data.pipelineItemId) accepted.push(data);
    }
    await repository.sealGroups(batch, accepted);
}

async function publishResearchers(batch: EtlBatch, queue: ResearcherQueue, repository: EtlQueueRepository) {
    const accepted: EtlResearcherJob[] = [];
    for (const data of batch.researcherJobs) {
        if (await repository.result(data)) { accepted.push(data); continue; }
        const stored = await enqueueEtlResearcher(data, queue);
        if (stored.data.pipelineItemId === data.pipelineItemId) accepted.push(data);
    }
    await repository.sealResearchers(batch, accepted);
}

async function reconcileJobs<T extends EtlGroupJob | EtlResearcherJob>(
    jobs: T[],
    getJob: (data: T) => Promise<RedisJob<T> | null>,
    enqueue: (data: T) => Promise<unknown>,
    repository: EtlQueueRepository,
) {
    for (let offset = 0; offset < jobs.length; offset += 500) {
      const slice = jobs.slice(offset, offset + 500);
      const completed = await repository.completedItems(slice);
      for (const data of slice) {
        if (completed.has(data.pipelineItemId)) continue;
        const job = await getJob(data);
        if (!job) {
            await enqueue(data);
            continue;
        }
        if (job.data.pipelineItemId !== data.pipelineItemId) {
            await repository.settle(data, null, 'Job ETL substituido no Redis antes da conciliacao.');
            continue;
        }
        const state = await job.getState();
        if (state === 'failed') await repository.settle(data, null, job.failedReason, job.attemptsMade);
        if (state === 'completed') {
            await repository.settle(data, null, 'Job ETL concluido no Redis sem resultado persistido no PostgreSQL.');
        }
      }
    }
}

const running = new WeakMap<EtlQueueRepository, Promise<void>>();

export function reconcileEtlQueues(
    groupQueue: GroupQueue,
    researcherQueue: ResearcherQueue,
    repository: EtlQueueRepository,
): Promise<void> {
    const previous = running.get(repository) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => reconcileOnce(groupQueue, researcherQueue, repository));
    running.set(repository, next);
    void next.finally(() => {
        if (running.get(repository) === next) running.delete(repository);
    }).catch(() => {});
    return next;
}

async function reconcileOnce(
    groupQueue: GroupQueue,
    researcherQueue: ResearcherQueue,
    repository: EtlQueueRepository,
) {
    for await (const initialBatch of repository.openBatches()) {
        if (!initialBatch.groupsPublished) await publishGroups(initialBatch, groupQueue, repository);

        const currentBatch = await repository.getOpenBatch(initialBatch.id);
        if (!currentBatch) continue;
        await reconcileJobs(
            currentBatch.groupJobs,
            data => groupQueue.getJob(etlGroupJobId(data.dgpId)),
            data => enqueueEtlGroup(data, groupQueue),
            repository,
        );

        const afterGroups = await repository.getOpenBatch(initialBatch.id);
        if (!afterGroups) continue;
        if (!afterGroups.researchersPublished && await repository.groupsFinished(afterGroups)) {
            await publishResearchers(afterGroups, researcherQueue, repository);
        }

        const afterPublication = await repository.getOpenBatch(initialBatch.id);
        if (!afterPublication?.researchersPublished) continue;
        await reconcileJobs(
            afterPublication.researcherJobs,
            data => researcherQueue.getJob(etlResearcherJobId(data.lattesId)),
            data => enqueueEtlResearcher(data, researcherQueue),
            repository,
        );
    }
    if(typeof repository.finalizeReports==='function') await repository.finalizeReports();
}
