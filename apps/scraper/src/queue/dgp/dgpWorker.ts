import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostname } from 'node:os';
import { createDgpScraperQueue, createQueueConnection, DGP_QUEUE_SETTINGS, QUEUE_NAMES, Worker } from '@oda/queue';
import { DgpQueueRepository } from './dgpRepository';
import { reconcileDgpQueue } from './dgpDispatch';

export async function runDgpWorker(queue: ReturnType<typeof createDgpScraperQueue>, repository: DgpQueueRepository) {
    await queue.setGlobalConcurrency(DGP_QUEUE_SETTINGS.concurrency);
    await reconcileDgpQueue(queue, repository);
    const workerName = process.env.DGP_WORKER_NAME || `dgp-${hostname()}-${process.pid}`;
    const worker = new Worker(QUEUE_NAMES.DGP_SCRAPER, pathToFileURL(path.join(__dirname, 'dgpProcessor.js')), {
        connection: createQueueConnection('worker'), concurrency: DGP_QUEUE_SETTINGS.concurrency,
        name: workerName, maxStalledCount: 1, maxStartedAttempts: 8, autorun: false,
    });
    let reconciliation: Promise<void> | undefined;
    let stopping = false;
    const sync = () => {
        if (!reconciliation && !stopping) {
            reconciliation = reconcileDgpQueue(queue, repository)
                .catch(error => console.error('[DGP Queue] Reconciliacao falhou; sera repetida.', error.message))
                .finally(() => { reconciliation = undefined; });
        }
    };
    const interval = setInterval(sync, DGP_QUEUE_SETTINGS.reconcileIntervalMs);
    worker.on('completed', job => {
        console.log('[DGP Worker] Concluido.', { jobId: job.id, dgpId: job.data.dgpId });
        sync();
    });
    worker.on('failed', (job, error) => {
        console.error('[DGP Worker] Tentativa falhou.', { jobId: job?.id, attemptsMade: job?.attemptsMade, erro: error.message });
        sync();
    });
    worker.on('stalled', jobId => console.warn('[DGP Worker] Lock expirou; BullMQ verificara a retomada.', { jobId }));
    worker.on('progress', (job, progress) => console.log('[DGP Worker] Progresso.', { jobId: job.id, progress }));
    worker.on('error', error => console.error('[DGP Worker] Erro de infraestrutura.', error.message));

    const shutdown = () => {
        if (stopping) return;
        stopping = true;
        clearInterval(interval);
        console.log('[DGP Worker] Encerrando depois do job ativo.');
        void worker.close().catch(error => console.error('[DGP Worker] Erro ao encerrar.', error.message));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    try {
        console.log(`[DGP Worker] ${workerName} aguardando jobs em ${QUEUE_NAMES.DGP_SCRAPER}.`);
        await worker.run();
    } finally {
        clearInterval(interval);
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
        await worker.close();
        await reconciliation;
        await reconcileDgpQueue(queue, repository);
    }
}
