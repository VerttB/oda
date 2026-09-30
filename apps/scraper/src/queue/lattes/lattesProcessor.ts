import '../env';
import {
    JOB_NAMES, SandboxedJob, ScrapeLattesResearcherJob, UnrecoverableError,
    validateScrapeLattesResearcherJob,
} from '@oda/queue';
import { TipoErroColeta } from '@oda/database';
import { prisma } from '../../common/database';
import {
    collectLattesResearcher, LattesCollectionError, LattesProgressUpdate,
} from '../../scrapers/lattesScraper';
import { LattesQueueRepository } from './lattesRepository';

const repository = new LattesQueueRepository(prisma);

export default async function processLattesJob(job: SandboxedJob<ScrapeLattesResearcherJob>) {
    try {
        validateScrapeLattesResearcherJob(job.data);
        if (job.name !== JOB_NAMES.SCRAPE_LATTES_RESEARCHER) throw new Error('Tipo de job Lattes desconhecido.');
    } catch (error) {
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
    }
    const cached = await repository.begin(job.data);
    if (cached) return cached;
    const reportProgress = async (progress: LattesProgressUpdate) => {
        try {
            await job.updateProgress({ ...progress, progressoEm: new Date().toISOString() });
        } catch (error) {
            console.warn('[Lattes Worker] Nao foi possivel atualizar o progresso.', {
                jobId: job.id,
                erro: error instanceof Error ? error.message : String(error),
            });
        }
    };
    try {
        const result = await collectLattesResearcher({ lattesId: job.data.lattesId, nome: job.data.nome }, reportProgress);
        await repository.settle(job.data, result);
        await reportProgress({ etapa: 'CONCLUIDO', percentual: 100, paginaAtual: null, paginasTotal: null });
        return result;
    } catch (error) {
        job.log(error instanceof Error ? error.message : String(error));
        if (error instanceof LattesCollectionError && error.tipoErro === TipoErroColeta.NAO_ENCONTRADO) {
            await repository.settle(job.data, null, error.message, job.attemptsMade + 1, error.tipoErro);
            throw new UnrecoverableError(error.message);
        }
        throw error;
    }
}
