import {
    createDiscoveryQueue, DiscoverDgpGroupsJob, discoveryJobId, enqueueDiscoveryKey,
} from '@oda/queue';
import { DiscoveryBatch, DiscoveryQueueRepository } from './discoveryRepository';

type Queue = ReturnType<typeof createDiscoveryQueue>;

export async function publishDiscoveryBatch(batch: DiscoveryBatch, queue: Queue, repository: DiscoveryQueueRepository) {
    const accepted: DiscoverDgpGroupsJob[] = [];
    for (const data of batch.jobs) {
        if (await repository.result(data)) { accepted.push(data); continue; }
        const stored = await enqueueDiscoveryKey(data, queue);
        if (stored.data.pipelineItemId === data.pipelineItemId) accepted.push(data);
    }
    await repository.seal(batch, accepted);
    return accepted.length;
}

export async function reconcileDiscoveryQueue(queue: Queue, repository: DiscoveryQueueRepository) {
    for await (const batch of repository.openBatches()) {
        if (!batch.published) {
            await publishDiscoveryBatch(batch, queue, repository);
            continue;
        }
        for (const data of batch.jobs) {
            if (await repository.result(data)) continue;
            const job = await queue.getJob(discoveryJobId(data.chave));
            if (!job) {
                await enqueueDiscoveryKey(data, queue);
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
