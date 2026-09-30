import {
    createLattesScraperQueue, enqueueLattesResearcher, lattesJobId,
    ScrapeLattesResearcherJob,
} from '@oda/queue';
import { LattesBatch, LattesQueueRepository } from './lattesRepository';

type Queue = ReturnType<typeof createLattesScraperQueue>;

export async function publishLattesBatch(batch: LattesBatch, queue: Queue, repository: LattesQueueRepository) {
    const accepted: ScrapeLattesResearcherJob[] = [];
    for (const data of batch.jobs) {
        if (await repository.result(data)) { accepted.push(data); continue; }
        const stored = await enqueueLattesResearcher(data, queue);
        if (stored.data.pipelineItemId === data.pipelineItemId) accepted.push(data);
    }
    await repository.seal(batch, accepted);
    return accepted.length;
}

export async function reconcileLattesQueue(queue: Queue, repository: LattesQueueRepository) {
    for await (const batch of repository.openBatches()) {
        if (!batch.published) {
            await publishLattesBatch(batch, queue, repository);
            continue;
        }
        for (const data of batch.jobs) {
            if (await repository.result(data)) continue;
            const job = await queue.getJob(lattesJobId(data.lattesId));
            if (!job) {
                await enqueueLattesResearcher(data, queue);
                continue;
            }
            if (job.data.pipelineItemId !== data.pipelineItemId) {
                await repository.settle(data, null, 'Job substituido no Redis antes da conciliacao.');
                continue;
            }
            const state = await job.getState();
            if (state === 'failed') await repository.settle(data, null, job.failedReason, job.attemptsMade);
            if (state === 'completed') {
                await repository.settle(data, null, 'Job concluido no Redis sem comprovacao de gravacao no PostgreSQL.');
            }
        }
    }
}
