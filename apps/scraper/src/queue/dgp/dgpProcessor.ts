import '../env';
import { JOB_NAMES, normalizeDataScope, SandboxedJob, ScrapeDgpGroupJob, UnrecoverableError, validateScrapeDgpGroupJob } from '@oda/queue';
import { prisma } from '../../common/database';
import { DgpQueueRepository } from './dgpRepository';
import { collectDgpJob } from './dgpSingleGroup';
import type { DgpProgressUpdate } from '../../scrapers/dgpScraper';

const repository = new DgpQueueRepository(prisma);

export default async function processDgpJob(job: SandboxedJob<ScrapeDgpGroupJob>) {
    try {
        validateScrapeDgpGroupJob(job.data);
        if (job.name !== JOB_NAMES.SCRAPE_DGP_GROUP) throw new Error('Tipo de job DGP desconhecido.');
    } catch (error) {
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
    }
    const cached = await repository.begin(job.data);
    if (cached) return cached;
    const reportProgress = async (progress: DgpProgressUpdate) => {
        try {
            await job.updateProgress({ ...progress, progressoEm: new Date().toISOString() });
        } catch (error) {
            console.warn('[DGP Worker] Nao foi possivel atualizar o progresso do job.', {
                jobId: job.id,
                erro: error instanceof Error ? error.message : String(error),
            });
        }
    };
    await reportProgress({
        etapa: 'INICIANDO', percentual: 0,
        itensProcessados: null, itensTotal: null,
    });
    try {
        const result = await collectDgpJob(job.data.dgpId, reportProgress, normalizeDataScope(job.data.scope));
        await repository.settle(job.data, result);
        await reportProgress({
            etapa: 'CONCLUIDO', percentual: 100,
            itensProcessados: null, itensTotal: null,
        });
        return result;
    } catch (error) {
        job.log(error instanceof Error ? error.message : String(error));
        throw error;
    }
}
