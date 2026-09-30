import { createDgpScraperQueue, dgpJobId, enqueueDgpGroup, ScrapeDgpGroupJob } from '@oda/queue';
import { DgpBatch, DgpQueueRepository } from './dgpRepository';

type Queue = ReturnType<typeof createDgpScraperQueue>;

export async function publishBatch(batch: DgpBatch, queue: Queue, repository: DgpQueueRepository) {
    const accepted: ScrapeDgpGroupJob[] = [];
    for (const data of batch.jobs) {
        // Uma publicacao interrompida pode ser retomada depois de jobs ja concluidos.
        if (await repository.result(data)) { accepted.push(data); continue; }
        const stored = await enqueueDgpGroup(data, queue);
        if (stored.data.pipelineItemId === data.pipelineItemId) accepted.push(data);
    }
    await repository.seal(batch, accepted);
    return accepted.length;
}

export async function reconcileDgpQueue(queue: Queue, repository: DgpQueueRepository) {
    for await (const batch of repository.openBatches()) {
        if (!batch.published) {
            await publishBatch(batch, queue, repository);
            continue;
        }
        for (const data of batch.jobs) {
            if (await repository.result(data)) continue;
            const job = await queue.getJob(dgpJobId(data.dgpId));
            if (!job) {
                // O manifesto no PostgreSQL permite republicar apos perda do Redis.
                await enqueueDgpGroup(data, queue);
                continue;
            }
            if (job.data.pipelineItemId !== data.pipelineItemId) {
                await repository.settle(data, null, 'Job substituido no Redis antes da conciliacao.');
                continue;
            }
            const state = await job.getState();
            if (state === 'failed') await repository.settle(data, null, job.failedReason, job.attemptsMade);
            if (state === 'completed') {
                // Sucesso real sempre e persistido pelo processor antes de completar no Redis.
                await repository.settle(data, null, 'Job concluido no Redis sem comprovacao de gravacao no PostgreSQL.');
            }
        }
    }
}
