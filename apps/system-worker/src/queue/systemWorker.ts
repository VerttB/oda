import { hostname } from 'node:os';
import { Worker } from 'bullmq';
import { createQueueConnection, QUEUE_NAMES, JOB_NAMES, SYSTEM_QUEUE_SETTINGS } from '@oda/queue';
import { createSystemQueue } from './systemQueue';
import { systemProcessor } from './systemProcessor';
import { prisma } from '../common/database';

const TZ = 'America/Sao_Paulo';

async function registerRepeatableJobs(queue: ReturnType<typeof createSystemQueue>) {
  // Backup diário 02:00
  await queue.add('backup-database', {
    version: 1,
    requestedAt: new Date().toISOString(),
    format: 'custom',
    retentionDays: 7,
  }, {
    repeat: { pattern: '0 2 * * *', tz: TZ },
    jobId: 'backup-db-daily',
    removeOnComplete: { age: 24 * 60 * 60, count: 30 },
    removeOnFail: false,
  });

  // Refresh MV a cada 12h (06:00 / 18:00)
  await queue.add('refresh-materialized-view', {
    version: 1,
    requestedAt: new Date().toISOString(),
    concurrently: true,
  }, {
    repeat: { pattern: '0 6,18 * * *', tz: TZ },
    jobId: 'refresh-mv-12h',
    removeOnComplete: { age: 12 * 60 * 60, count: 100 },
    removeOnFail: false,
  });

  // Cleanup logs - 03:00
  await queue.add('cleanup-old-logs', {
    version: 1,
    requestedAt: new Date().toISOString(),
    retentionDays: 30,
  }, {
    repeat: { pattern: '0 3 * * *', tz: TZ },
    jobId: 'cleanup-logs-daily',
    removeOnComplete: { age: 24 * 60 * 60, count: 30 },
    removeOnFail: false,
  });

  // Reconciliação filas presas - 04:00
  await queue.add('reconcile-stuck-queues', {
    version: 1,
    requestedAt: new Date().toISOString(),
    staleDays: 14,
  }, {
    repeat: { pattern: '0 4 * * *', tz: TZ },
    jobId: 'reconcile-stuck-queues-daily',
    removeOnComplete: { age: 24 * 60 * 60, count: 30 },
    removeOnFail: false,
  });
}

export async function runSystemWorker() {
  const queue = createSystemQueue();

  queue.on('error', (error) => {
    console.error('[System Queue] Redis error:', error.message);
  });

  // Registra jobs repeatable
  await registerRepeatableJobs(queue);

  const workerName = process.env['SYSTEM_WORKER_NAME'] || `system-${hostname()}-${process.pid}`;

  const worker = new Worker(
    'oda-system-maintenance',
    systemProcessor,
    {
      connection: createQueueConnection('worker'),
      concurrency: SYSTEM_QUEUE_SETTINGS.concurrency,
      name: workerName,
      maxStalledCount: 1,
      maxStartedAttempts: 8,
      autorun: false,
    }
  );

  let stopping = false;

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log('[System Worker] Encerrando...');
    await worker.close().catch((error) => console.error('[System Worker] Erro ao encerrar:', error.message));
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  worker.on('completed', (job) => {
    console.log('[System Worker] Job concluído.', { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, error) => {
    console.error('[System Worker] Job falhou.', {
      jobId: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      error: error.message,
    });
  });

  worker.on('stalled', (jobId) => {
    console.warn('[System Worker] Job stalled.', { jobId });
  });

  worker.on('error', (error) => {
    console.error('[System Worker] Erro de infraestrutura:', error.message);
  });

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  console.log(`[System Worker] ${workerName} aguardando jobs em oda-system-maintenance.`);
  await worker.run();
}

runSystemWorker().catch((error) => {
  console.error('[System Worker] Erro fatal:', error);
  process.exit(1);
});