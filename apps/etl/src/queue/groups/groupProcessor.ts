import '../env';
import {
    EtlGroupJob, JOB_NAMES, normalizeDataScope, SandboxedJob, UnrecoverableError, validateEtlGroupJob,
} from '@oda/queue';
import { assertFileHash, EtlInputError, resolveEtlFile } from '../../commom/etlFile';
import { processGroupEtlFile, GroupEtlProgressUpdate } from '../../dgpEtl';
import { prisma } from '../database';
import { EtlQueueRepository } from '../etlRepository';

const repository = new EtlQueueRepository(prisma);

export default async function processGroupJob(job: SandboxedJob<EtlGroupJob>) {
    try {
        validateEtlGroupJob(job.data);
        if (job.name !== JOB_NAMES.ETL_GROUP) throw new Error('Tipo de job ETL de grupo desconhecido.');
    } catch (error) {
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
    }

    const cached = await repository.begin(job.data);
    if (cached) return cached;
    const reportProgress = async (progress: GroupEtlProgressUpdate) => {
        try {
            await job.updateProgress({ ...progress, progressoEm: new Date().toISOString() });
        } catch (error) {
            console.warn('[ETL Grupo] Nao foi possivel atualizar o progresso.', {
                jobId: job.id,
                erro: error instanceof Error ? error.message : String(error),
            });
        }
    };

    try {
        const scope = normalizeDataScope(job.data.scope);
        const filePath = resolveEtlFile('dgp', job.data.arquivoJson, scope);
        assertFileHash(filePath, job.data.hashArquivo, job.data.tamanhoBytes);
        const result = await processGroupEtlFile(filePath, job.data.dgpId, reportProgress, scope);
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
