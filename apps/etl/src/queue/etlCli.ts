import './env';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    createEtlGroupQueue, createEtlResearcherQueue, DataScope, etlGroupJobId, etlResearcherJobId, parseDataScope,
    validateEtlGroupJob, validateEtlResearcherJob,
} from '@oda/queue';
import { getEtlDataPaths } from '../commom/config';
import { inspectEtlFile, resolveEtlFile } from '../commom/etlFile';
import { prisma } from './database';
import { reconcileEtlQueues } from './etlDispatch';
import { EtlFileDescriptor, EtlQueueRepository } from './etlRepository';
import { runEtlWorkers } from './etlWorker';

type EtlKind = 'grupos' | 'pesquisadores';
type EnqueueScope = EtlKind | 'all';

function printHelp() {
    console.log('pnpm queue:etl:prepare');
    console.log('pnpm queue:etl:enqueue [grupos] [--scope simcc] [id ...]');
    console.log('pnpm queue:etl:enqueue [all|grupos|pesquisadores] [id ...]');
    console.log('pnpm queue:etl:worker');
    console.log('pnpm queue:etl:status [grupos|pesquisadores] [id]');
    console.log('pnpm queue:etl:reconcile');
    console.log('Sem IDs, enqueue le todos os JSONs ainda presentes em raw-data.');
}

function parseArgs(args: string[]) {
    let scope: DataScope = 'default';
    const positional: string[] = [];
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--scope') scope = parseDataScope(args[++index]);
        else if (arg.startsWith('--scope=')) scope = parseDataScope(arg.slice('--scope='.length));
        else positional.push(arg);
    }
    return { scope, positional };
}

function listDescriptors(kind: EtlKind, ids: string[], scope: DataScope): EtlFileDescriptor[] {
    const fileKind = kind === 'grupos' ? 'dgp' : 'lattes';
    const paths = getEtlDataPaths(scope);
    const rawDir = kind === 'grupos' ? paths.dgpDir : paths.lattesDir;
    const files = ids.length
        ? [...new Set(ids)].map(id => {
            if (!/^\d{16}$/.test(id)) throw new Error(`ID ETL invalido: ${id}`);
            return resolveEtlFile(fileKind, `${id}.json`, scope);
        })
        : fs.existsSync(rawDir)
            ? fs.readdirSync(rawDir).filter(file => /^\d{16}\.json$/.test(file)).sort().map(file => path.join(rawDir, file))
            : [];
    return files.map(filePath => ({
        id: path.basename(filePath, '.json'),
        scope,
        ...inspectEtlFile(filePath),
    }));
}

async function availableGroups(
    files: EtlFileDescriptor[],
    queue: ReturnType<typeof createEtlGroupQueue>,
    repository: EtlQueueRepository,
) {
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

async function availableResearchers(
    files: EtlFileDescriptor[],
    queue: ReturnType<typeof createEtlResearcherQueue>,
    repository: EtlQueueRepository,
) {
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

async function printStatus(
    kind: EtlKind | undefined,
    id: string | undefined,
    groupQueue: ReturnType<typeof createEtlGroupQueue>,
    researcherQueue: ReturnType<typeof createEtlResearcherQueue>,
) {
    if (!kind) {
        console.log('Grupos:', await groupQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'));
        console.log('Pesquisadores:', await researcherQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'));
        return;
    }
    if (id && !/^\d{16}$/.test(id)) throw new Error(`ID ETL invalido: ${id}`);
    if (!id) {
        const queue = kind === 'grupos' ? groupQueue : researcherQueue;
        console.log(await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'));
        return;
    }
    const job = kind === 'grupos'
        ? await groupQueue.getJob(etlGroupJobId(id))
        : await researcherQueue.getJob(etlResearcherJobId(id));
    console.log(job ? {
        id: job.id,
        estado: await job.getState(),
        progresso: job.progress,
        tentativas: job.attemptsMade,
        erro: job.failedReason,
        resultado: job.returnvalue,
        pipelineLogId: job.data.pipelineLogId,
    } : 'Job nao encontrado no Redis. O historico permanece no PostgreSQL.');
}

async function main() {
    const [command, ...rawArgs] = process.argv.slice(2);
    const { scope: dataScope, positional } = parseArgs(rawArgs);
    const [firstArg, ...remaining] = positional;
    if (!command || process.argv.includes('--help') || process.argv.includes('-h')) { printHelp(); return; }
    if (!['enqueue', 'worker', 'status', 'reconcile'].includes(command)) throw new Error('Comando de fila ETL desconhecido. Use --help.');
    if (command !== 'enqueue' && dataScope !== 'default') throw new Error('--scope so pode ser usado ao enfileirar o ETL.');

    const groupQueue = createEtlGroupQueue();
    const researcherQueue = createEtlResearcherQueue();
    const repository = new EtlQueueRepository(prisma);
    try {
        if (command === 'worker') {
            if (firstArg) throw new Error('O comando worker nao recebe argumentos.');
            await runEtlWorkers(groupQueue, researcherQueue, repository);
            return;
        }
        if (command === 'reconcile') {
            if (firstArg) throw new Error('O comando reconcile nao recebe argumentos.');
            await reconcileEtlQueues(groupQueue, researcherQueue, repository);
            console.log('[ETL Queue] Reconciliacao concluida.');
            return;
        }
        if (command === 'status') {
            const kind = firstArg as EtlKind | undefined;
            if (kind && kind !== 'grupos' && kind !== 'pesquisadores') throw new Error('Use status grupos ou status pesquisadores.');
            if (remaining.length > 1) throw new Error('Consulte apenas um job por vez.');
            await printStatus(kind, remaining[0], groupQueue, researcherQueue);
            return;
        }

        const enqueueScope = (firstArg || 'all') as EnqueueScope;
        if (!['all', 'grupos', 'pesquisadores'].includes(enqueueScope)) throw new Error('Use enqueue all, enqueue grupos ou enqueue pesquisadores.');
        if (enqueueScope === 'all' && remaining.length) throw new Error('IDs explicitos exigem o escopo grupos ou pesquisadores.');
        if (dataScope === 'simcc' && enqueueScope !== 'grupos') {
            throw new Error('O escopo SIMCC processa apenas grupos. Use enqueue grupos --scope simcc.');
        }
        await reconcileEtlQueues(groupQueue, researcherQueue, repository);
        const groupFiles = enqueueScope === 'all' || enqueueScope === 'grupos'
            ? listDescriptors('grupos', remaining, dataScope) : [];
        const researcherFiles = enqueueScope === 'all' || enqueueScope === 'pesquisadores'
            ? listDescriptors('pesquisadores', remaining, dataScope) : [];
        const groups = await availableGroups(groupFiles, groupQueue, repository);
        const researchers = await availableResearchers(researcherFiles, researcherQueue, repository);
        if (!groups.length && !researchers.length) {
            console.log('[ETL Queue] Nenhum arquivo novo para publicar.');
            return;
        }
        const batch = await repository.createBatch(groups, researchers);
        await reconcileEtlQueues(groupQueue, researcherQueue, repository);
        console.log('[ETL Queue] Lote criado.', {
            pipelineLogId: batch.id,
            scope: dataScope,
            grupos: groups.length,
            pesquisadores: researchers.length,
            pesquisadoresAguardandoGrupos: groups.length > 0 && researchers.length > 0,
        });
    } finally {
        await Promise.all([groupQueue.close(), researcherQueue.close()]);
    }
}

main().catch(error => {
    console.error('[ETL Queue]', error.message);
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
