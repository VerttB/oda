import '../env';
import {
    EtlResearcherJob, JOB_NAMES, SandboxedJob, UnrecoverableError, validateEtlResearcherJob,
} from '@oda/queue';
import { assertFileHash, EtlInputError, resolveEtlFile } from '../../commom/etlFile';
import { processResearcherEtlFile, ResearcherEtlProgressUpdate } from '../../lattesEtl';
import { prisma } from '../database';
import { EtlQueueRepository } from '../etlRepository';

const repository = new EtlQueueRepository(prisma);

export default async function processResearcherJob(job: SandboxedJob<EtlResearcherJob>) {
    try {
        validateEtlResearcherJob(job.data);
        if (job.name !== JOB_NAMES.ETL_RESEARCHER) throw new Error('Tipo de job ETL de pesquisador desconhecido.');
    } catch (error) {
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
    }

    const cached = await repository.begin(job.data);
    if (cached) return cached;
    const reportProgress = async (progress: ResearcherEtlProgressUpdate) => {
        try {
            await job.updateProgress({ ...progress, progressoEm: new Date().toISOString() });
        } catch (error) {
            console.warn('[ETL Pesquisador] Nao foi possivel atualizar o progresso.', {
                jobId: job.id,
                erro: error instanceof Error ? error.message : String(error),
            });
        }
    };

    try {
        const filePath = resolveEtlFile('lattes', job.data.arquivoJson);
        assertFileHash(filePath, job.data.hashArquivo, job.data.tamanhoBytes);
        const result = await processResearcherEtlFile(filePath, job.data.lattesId, reportProgress);
        await repository.settle(job.data, result);
        return result;
    } catch (error) {
        job.log(error instanceof Error ? error.message : String(error));
        if (error instanceof EtlInputError) {
            await repository.settle(job.data, null, error.message, job.attemptsMade + 1);
            throw new UnrecoverableError(error.message);
        }
        throw error;
    }
}
