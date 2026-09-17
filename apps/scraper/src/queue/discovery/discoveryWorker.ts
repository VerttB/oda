import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostname } from 'node:os';
import {
    createDiscoveryQueue, createQueueConnection, DISCOVERY_QUEUE_SETTINGS, QUEUE_NAMES, Worker,
} from '@oda/queue';
import { reconcileDiscoveryQueue } from './discoveryDispatch';
import { DiscoveryQueueRepository } from './discoveryRepository';

export async function runDiscoveryWorker(queue: ReturnType<typeof createDiscoveryQueue>, repository: DiscoveryQueueRepository) {
    await queue.setGlobalConcurrency(DISCOVERY_QUEUE_SETTINGS.concurrency);
    await reconcileDiscoveryQueue(queue, repository);
    const workerName = process.env.DISCOVERY_WORKER_NAME || `discovery-${hostname()}-${process.pid}`;
    const worker = new Worker(QUEUE_NAMES.DGP_DISCOVERY, pathToFileURL(path.join(__dirname, 'discoveryProcessor.js')), {
        connection: createQueueConnection('worker'),
        concurrency: DISCOVERY_QUEUE_SETTINGS.concurrency,
        name: workerName,
        maxStalledCount: 1,
        maxStartedAttempts: 8,
        autorun: false,
    });
    let reconciliation: Promise<void> | undefined;
    let stopping = false;
    const sync = () => {
        if (!reconciliation && !stopping) {
            reconciliation = reconcileDiscoveryQueue(queue, repository)
                .catch(error => console.error('[Discovery Queue] Reconciliacao falhou; sera repetida.', error.message))
                .finally(() => { reconciliation = undefined; });
        }
    };
    const interval = setInterval(sync, DISCOVERY_QUEUE_SETTINGS.reconcileIntervalMs);
    worker.on('completed', job => { console.log('[Discovery Worker] Concluido.', { jobId: job.id, chave: job.data.chave }); sync(); });
    worker.on('failed', (job, error) => { console.error('[Discovery Worker] Tentativa falhou.', { jobId: job?.id, attemptsMade: job?.attemptsMade, erro: error.message }); sync(); });
    worker.on('stalled', jobId => console.warn('[Discovery Worker] Lock expirou; BullMQ verificara a retomada.', { jobId }));
    worker.on('progress', (job, progress) => console.log('[Discovery Worker] Progresso.', { jobId: job.id, progress }));
    worker.on('error', error => console.error('[Discovery Worker] Erro de infraestrutura.', error.message));
    const shutdown = () => {
        if (stopping) return;
        stopping = true;
        clearInterval(interval);
        console.log('[Discovery Worker] Encerrando depois do job ativo.');
        void worker.close().catch(error => console.error('[Discovery Worker] Erro ao encerrar.', error.message));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    try {
        console.log(`[Discovery Worker] ${workerName} aguardando jobs em ${QUEUE_NAMES.DGP_DISCOVERY}.`);
        await worker.run();
    } finally {
        clearInterval(interval);
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
        await worker.close();
        await reconciliation;
        await reconcileDiscoveryQueue(queue, repository);
    }
}
