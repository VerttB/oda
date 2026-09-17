import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostname } from 'node:os';
import {
    createLattesScraperQueue, createQueueConnection, LATTES_QUEUE_SETTINGS, QUEUE_NAMES, Worker,
} from '@oda/queue';
import { reconcileLattesQueue } from './lattesDispatch';
import { LattesQueueRepository } from './lattesRepository';

export async function runLattesWorker(queue: ReturnType<typeof createLattesScraperQueue>, repository: LattesQueueRepository) {
    await queue.setGlobalConcurrency(LATTES_QUEUE_SETTINGS.concurrency);
    await reconcileLattesQueue(queue, repository);
    const workerName = process.env.LATTES_WORKER_NAME || `lattes-${hostname()}-${process.pid}`;
    const worker = new Worker(QUEUE_NAMES.LATTES_SCRAPER, pathToFileURL(path.join(__dirname, 'lattesProcessor.js')), {
        connection: createQueueConnection('worker'),
        concurrency: LATTES_QUEUE_SETTINGS.concurrency,
        name: workerName,
        maxStalledCount: 1,
        maxStartedAttempts: 8,
        autorun: false,
    });
    let reconciliation: Promise<void> | undefined;
    let stopping = false;
    const sync = () => {
        if (!reconciliation && !stopping) {
            reconciliation = reconcileLattesQueue(queue, repository)
                .catch(error => console.error('[Lattes Queue] Reconciliacao falhou; sera repetida.', error.message))
                .finally(() => { reconciliation = undefined; });
        }
    };
    const interval = setInterval(sync, LATTES_QUEUE_SETTINGS.reconcileIntervalMs);
    worker.on('completed', job => { console.log('[Lattes Worker] Concluido.', { jobId: job.id, lattesId: job.data.lattesId }); sync(); });
    worker.on('failed', (job, error) => { console.error('[Lattes Worker] Tentativa falhou.', { jobId: job?.id, attemptsMade: job?.attemptsMade, erro: error.message }); sync(); });
    worker.on('stalled', jobId => console.warn('[Lattes Worker] Lock expirou; BullMQ verificara a retomada.', { jobId }));
    worker.on('progress', (job, progress) => console.log('[Lattes Worker] Progresso.', { jobId: job.id, progress }));
    worker.on('error', error => console.error('[Lattes Worker] Erro de infraestrutura.', error.message));

    const shutdown = () => {
        if (stopping) return;
        stopping = true;
        clearInterval(interval);
        console.log('[Lattes Worker] Encerrando depois do job ativo.');
        void worker.close().catch(error => console.error('[Lattes Worker] Erro ao encerrar.', error.message));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    try {
        console.log(`[Lattes Worker] ${workerName} aguardando jobs em ${QUEUE_NAMES.LATTES_SCRAPER}.`);
        await worker.run();
    } finally {
        clearInterval(interval);
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
        await worker.close();
        await reconciliation;
        await reconcileLattesQueue(queue, repository);
    }
}
