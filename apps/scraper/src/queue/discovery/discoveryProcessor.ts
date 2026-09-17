import '../env';
import {
    DiscoverDgpGroupsJob, JOB_NAMES, SandboxedJob, UnrecoverableError,
    validateDiscoverDgpGroupsJob,
} from '@oda/queue';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../common/database';
import { DiscoveryProgressUpdate, runDgpDiscovery } from '../../scrapers/dgpDiscovery';
import { DiscoveryQueueRepository } from './discoveryRepository';

const repository = new DiscoveryQueueRepository(prisma);

export default async function processDiscoveryJob(job: SandboxedJob<DiscoverDgpGroupsJob>) {
    try {
        validateDiscoverDgpGroupsJob(job.data);
        if (job.name !== JOB_NAMES.DISCOVER_DGP_GROUPS) throw new Error('Tipo de job de descoberta desconhecido.');
    } catch (error) {
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
    }
    const cached = await repository.begin(job.data);
    if (cached) return cached;
    const reportProgress = async (progress: DiscoveryProgressUpdate) => {
        try {
            await job.updateProgress({ ...progress, progressoEm: new Date().toISOString() });
        } catch (error) {
            console.warn('[Discovery Worker] Nao foi possivel atualizar o progresso.', {
                jobId: job.id,
                erro: error instanceof Error ? error.message : String(error),
            });
        }
    };
    try {
        const result = await runDgpDiscovery([job.data.chave], {
            pipelineLogId: job.data.pipelineLogId,
            executionId: `bull-${randomUUID()}`,
            reportProgress,
        });
        await repository.settle(job.data, result);
        return result;
    } catch (error) {
        job.log(error instanceof Error ? error.message : String(error));
        throw error;
    }
}
