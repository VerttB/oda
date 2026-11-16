import { hostname } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    createEtlDispatchQueue, createEtlGroupQueue, createEtlResearcherQueue, createQueueConnection,
    ETL_DISPATCH_QUEUE_SETTINGS, ETL_GROUP_QUEUE_SETTINGS, ETL_RESEARCHER_QUEUE_SETTINGS,
    JOB_NAMES, QUEUE_NAMES, validateEtlDispatchJob, Worker,
} from '@oda/queue';
import { reconcileEtlQueues } from './etlDispatch';
import { EtlQueueRepository } from './etlRepository';
import { prepareEtlBatch } from './etlBatch';
import { startAdaptiveEtl,ADAPTIVE_ETL } from './adaptiveConcurrency';
import { prisma } from './database';

type GroupQueue = ReturnType<typeof createEtlGroupQueue>;
type ResearcherQueue = ReturnType<typeof createEtlResearcherQueue>;
type DispatchQueue = ReturnType<typeof createEtlDispatchQueue>;

export async function runEtlWorkers(
    groupQueue: GroupQueue, researcherQueue: ResearcherQueue, dispatchQueue: DispatchQueue, repository: EtlQueueRepository,
) {
    await Promise.all([
        groupQueue.setGlobalConcurrency(ETL_GROUP_QUEUE_SETTINGS.concurrency),
        ...(repository.scope === 'default' ? [researcherQueue.setGlobalConcurrency(ADAPTIVE_ETL.max)] : []),
        dispatchQueue.setGlobalConcurrency(ETL_DISPATCH_QUEUE_SETTINGS.concurrency),
    ]);
    const groupWorker = new Worker(
        groupQueue.name,
        pathToFileURL(path.join(__dirname, 'groups/groupProcessor.js')),
        {
            connection: createQueueConnection('worker'), concurrency: ETL_GROUP_QUEUE_SETTINGS.concurrency,
            name: process.env.ETL_GROUP_WORKER_NAME || `etl-grupos-${hostname()}-${process.pid}`,
            maxStalledCount: 1, maxStartedAttempts: 8, autorun: false,
        },
    );
    const researcherWorker = repository.scope === 'default' ? new Worker(
        QUEUE_NAMES.ETL_RESEARCHERS,
        pathToFileURL(path.join(__dirname, 'researchers/researcherProcessor.js')),
        {
            connection: createQueueConnection('worker'), concurrency: ETL_RESEARCHER_QUEUE_SETTINGS.concurrency,
            name: process.env.ETL_RESEARCHER_WORKER_NAME || `etl-pesquisadores-${hostname()}-${process.pid}`,
            maxStalledCount: 1, maxStartedAttempts: 8, autorun: false,
        },
    ) : null;
    const dispatchWorker = new Worker(
        dispatchQueue.name,
        async job => {
            if (job.name !== JOB_NAMES.ETL_DISPATCH) throw new Error('Tipo de job de despacho ETL desconhecido.');
            validateEtlDispatchJob(job.data);
            if (job.data.scope !== repository.scope) throw new Error('Despacho ETL pertence a outro escopo.');
            const update = (etapa: string, percentual: number) => job.updateProgress({
                etapa, percentual, progressoEm: new Date().toISOString(),
            });
            await update('INICIANDO', 0);
            const result = await prepareEtlBatch(job.data, groupQueue, researcherQueue, repository, update);
            await update('CONCLUIDO', 100);
            return result;
        },
        {
            connection: createQueueConnection('worker'), concurrency: ETL_DISPATCH_QUEUE_SETTINGS.concurrency,
            name: process.env.ETL_DISPATCH_WORKER_NAME || `etl-despacho-${hostname()}-${process.pid}`,
            maxStalledCount: 1, maxStartedAttempts: 8, autorun: false,
        },
    );

    const workers = [dispatchWorker, groupWorker, ...(researcherWorker ? [researcherWorker] : [])];
    const stopAdaptive=researcherWorker ? startAdaptiveEtl(researcherWorker,researcherQueue,async()=>{
      try {
        return await prisma.$transaction(async tx=>{
          await tx.$executeRaw`SET LOCAL statement_timeout='1500ms'`;
          const [row]=await tx.$queryRaw<Array<{ready:boolean}>>`SELECT NOT EXISTS(
            SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
            AND cardinality(pg_blocking_pids(pid))>0) AS ready`;
          return row.ready;
        },{timeout:2500,maxWait:1000});
      } catch {return false;}
    }) : ()=>{};
    let reconciliation: Promise<void> | undefined;
    let stopping = false;
    const sync = () => {
        if (reconciliation || stopping) return;
        reconciliation = reconcileEtlQueues(groupQueue, researcherQueue, repository)
            .catch(error => console.error('[ETL Queue] Reconciliacao falhou; sera repetida.', error.message))
            .finally(() => { reconciliation = undefined; });
    };
    const interval = setInterval(sync, Math.min(
        ETL_GROUP_QUEUE_SETTINGS.reconcileIntervalMs,
        ETL_RESEARCHER_QUEUE_SETTINGS.reconcileIntervalMs,
    ));
    for (const worker of workers) {
        worker.on('completed', job => { console.log('[ETL Worker] Concluido.', { fila: worker.name, jobId: job.id }); sync(); });
        worker.on('failed', (job, error) => { console.error('[ETL Worker] Tentativa falhou.', { fila: worker.name, jobId: job?.id, erro: error.message }); sync(); });
        worker.on('stalled', jobId => console.warn('[ETL Worker] Lock expirou; BullMQ verificara a retomada.', { fila: worker.name, jobId }));
        worker.on('progress', (job, progress) => console.log('[ETL Worker] Progresso.', { fila: worker.name, jobId: job.id, progress }));
        worker.on('error', error => console.error('[ETL Worker] Erro de infraestrutura.', { fila: worker.name, erro: error.message }));
    }

    const shutdown = () => {
        if (stopping) return;
        stopping = true;
        clearInterval(interval);
        stopAdaptive();
        console.log('[ETL Worker] Encerrando depois dos jobs ativos.');
        void Promise.all(workers.map(worker => worker.close()));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    try {
        console.log(`[ETL Worker] Escopo ${repository.scope}: aguardando jobs em ${workers.map(worker => worker.name).join(', ')}.`);
        // A recuperação pode percorrer milhares de itens; não deve impedir o consumo.
        sync();
        await Promise.all(workers.map(worker => worker.run()));
    } finally {
        stopAdaptive();
        clearInterval(interval);
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
        await Promise.all(workers.map(worker => worker.close()));
        await reconciliation;
        await reconcileEtlQueues(groupQueue, researcherQueue, repository);
    }
}
