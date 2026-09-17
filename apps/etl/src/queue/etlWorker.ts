import { hostname } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    createEtlGroupQueue, createEtlResearcherQueue, createQueueConnection,
    ETL_GROUP_QUEUE_SETTINGS, ETL_RESEARCHER_QUEUE_SETTINGS, QUEUE_NAMES, Worker,
} from '@oda/queue';
import { reconcileEtlQueues } from './etlDispatch';
import { EtlQueueRepository } from './etlRepository';

type GroupQueue = ReturnType<typeof createEtlGroupQueue>;
type ResearcherQueue = ReturnType<typeof createEtlResearcherQueue>;

export async function runEtlWorkers(groupQueue: GroupQueue, researcherQueue: ResearcherQueue, repository: EtlQueueRepository) {
    await Promise.all([
        groupQueue.setGlobalConcurrency(ETL_GROUP_QUEUE_SETTINGS.concurrency),
        researcherQueue.setGlobalConcurrency(ETL_RESEARCHER_QUEUE_SETTINGS.concurrency),
    ]);
    await reconcileEtlQueues(groupQueue, researcherQueue, repository);

    const groupWorker = new Worker(
        QUEUE_NAMES.ETL_GROUPS,
        pathToFileURL(path.join(__dirname, 'groups/groupProcessor.js')),
        {
            connection: createQueueConnection('worker'), concurrency: ETL_GROUP_QUEUE_SETTINGS.concurrency,
            name: process.env.ETL_GROUP_WORKER_NAME || `etl-grupos-${hostname()}-${process.pid}`,
            maxStalledCount: 1, maxStartedAttempts: 8, autorun: false,
        },
    );
    const researcherWorker = new Worker(
        QUEUE_NAMES.ETL_RESEARCHERS,
        pathToFileURL(path.join(__dirname, 'researchers/researcherProcessor.js')),
        {
            connection: createQueueConnection('worker'), concurrency: ETL_RESEARCHER_QUEUE_SETTINGS.concurrency,
            name: process.env.ETL_RESEARCHER_WORKER_NAME || `etl-pesquisadores-${hostname()}-${process.pid}`,
            maxStalledCount: 1, maxStartedAttempts: 8, autorun: false,
        },
    );

    const workers = [groupWorker, researcherWorker];
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
        console.log('[ETL Worker] Encerrando depois dos jobs ativos.');
        void Promise.all(workers.map(worker => worker.close()));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    try {
        console.log(`[ETL Worker] Aguardando grupos em ${QUEUE_NAMES.ETL_GROUPS} e pesquisadores em ${QUEUE_NAMES.ETL_RESEARCHERS}.`);
        await Promise.all(workers.map(worker => worker.run()));
    } finally {
        clearInterval(interval);
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
        await Promise.all(workers.map(worker => worker.close()));
        await reconciliation;
        await reconcileEtlQueues(groupQueue, researcherQueue, repository);
    }
}
