import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    createEtlGroupQueue, createEtlResearcherQueue, DataScope, EtlDispatchJob, EtlDispatchResult,
    etlGroupJobId, etlResearcherJobId, validateEtlGroupJob, validateEtlResearcherJob,
} from '@oda/queue';
import { getEtlDataPaths } from '../commom/config';
import { inspectEtlFile, resolveEtlFile } from '../commom/etlFile';
import { reconcileEtlQueues } from './etlDispatch';
import { EtlFileDescriptor, EtlQueueRepository } from './etlRepository';

type GroupQueue = ReturnType<typeof createEtlGroupQueue>;
type ResearcherQueue = ReturnType<typeof createEtlResearcherQueue>;
type EtlKind = 'grupos' | 'pesquisadores';

function listDescriptors(kind: EtlKind, ids: string[], scope: DataScope): EtlFileDescriptor[] {
    const fileKind = kind === 'grupos' ? 'dgp' : 'lattes';
    const paths = getEtlDataPaths(scope);
    const rawDir = kind === 'grupos' ? paths.dgpDir : paths.lattesDir;
    const files = ids.length
        ? ids.map(id => resolveEtlFile(fileKind, `${id}.json`, scope))
        : fs.existsSync(rawDir)
            ? fs.readdirSync(rawDir).filter(file => /^\d{16}\.json$/.test(file)).sort().map(file => path.join(rawDir, file))
            : [];
    return files.map(filePath => ({
        id: path.basename(filePath, '.json'), scope, ...inspectEtlFile(filePath),
    }));
}

async function availableGroups(files: EtlFileDescriptor[], queue: GroupQueue, repository: EtlQueueRepository) {
    const available: EtlFileDescriptor[] = [];
    for (const file of files) {
        const existing = await queue.getJob(etlGroupJobId(file.id));
        if (!existing) { available.push(file); continue; }
        const state = await existing.getState();
        if (state !== 'completed' && state !== 'failed') continue;
        validateEtlGroupJob(existing.data);
        if (!await repository.result(existing.data)) throw new Error(`Reconcile o job ${existing.id} antes de republicar.`);
        await existing.remove();
        available.push(file);
    }
    return available;
}

async function availableResearchers(files: EtlFileDescriptor[], queue: ResearcherQueue, repository: EtlQueueRepository) {
    const available: EtlFileDescriptor[] = [];
    for (const file of files) {
        const existing = await queue.getJob(etlResearcherJobId(file.id));
        if (!existing) { available.push(file); continue; }
        const state = await existing.getState();
        if (state !== 'completed' && state !== 'failed') continue;
        validateEtlResearcherJob(existing.data);
        if (!await repository.result(existing.data)) throw new Error(`Reconcile o job ${existing.id} antes de republicar.`);
        await existing.remove();
        available.push(file);
    }
    return available;
}

export async function prepareEtlBatch(
    data: EtlDispatchJob,
    groupQueue: GroupQueue,
    researcherQueue: ResearcherQueue,
    repository: EtlQueueRepository,
    progress: (etapa: string, percentual: number) => Promise<void>,
): Promise<EtlDispatchResult> {
    await progress('LENDO_ARQUIVOS', 20);
    await reconcileEtlQueues(groupQueue, researcherQueue, repository);
    const existing = await repository.getBatch(data.requestId);
    if (existing) {
        return {
            requestId: data.requestId, pipelineLogId: existing.id,
            grupos: existing.groupJobs.length, pesquisadores: existing.researcherJobs.length,
        };
    }
    const groupFiles = data.tipo === 'TODOS' || data.tipo === 'GRUPOS'
        ? listDescriptors('grupos', data.ids, data.scope) : [];
    const researcherFiles = data.tipo === 'TODOS' || data.tipo === 'PESQUISADORES'
        ? listDescriptors('pesquisadores', data.ids, data.scope) : [];
    const groups = await availableGroups(groupFiles, groupQueue, repository);
    const researchers = await availableResearchers(researcherFiles, researcherQueue, repository);
    if (!groups.length && !researchers.length) {
        return { requestId: data.requestId, pipelineLogId: null, grupos: 0, pesquisadores: 0 };
    }

    await progress('CRIANDO_LOTE', 60);
    const batch = await repository.createBatch(groups, researchers, data.requestId);
    await progress('PUBLICANDO', 80);
    await reconcileEtlQueues(groupQueue, researcherQueue, repository);
    return {
        requestId: data.requestId,
        pipelineLogId: batch.id,
        grupos: groups.length,
        pesquisadores: researchers.length,
    };
}
