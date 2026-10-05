import { Queue } from 'bullmq';
import { createQueueConnection } from '@oda/queue';
import { QUEUE_NAMES, SYSTEM_QUEUE_SETTINGS } from '@oda/queue';
import type { BackupDbJob, RefreshMvJob, CleanupLogsJob, ReconcileStuckQueuesJob } from '@oda/queue';

function systemDefaultJobOptions() {
  return {
    attempts: SYSTEM_QUEUE_SETTINGS.attempts,
    backoff: { type: 'exponential' as const, delay: SYSTEM_QUEUE_SETTINGS.retryDelayMs },
    removeOnComplete: { age: 24 * 60 * 60, count: 100 },
    removeOnFail: false,
  };
}

export function createSystemQueue() {
  return new Queue(QUEUE_NAMES.SYSTEM_MAINTENANCE, {
    connection: createQueueConnection('producer'),
    defaultJobOptions: systemDefaultJobOptions(),
  });
}

export async function enqueueBackupDb(data: BackupDbJob, queue: ReturnType<typeof createSystemQueue>) {
  const id = `backup-db-${Date.now()}`;
  await queue.add('backup-database', data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}

export async function enqueueRefreshMv(data: RefreshMvJob, queue: ReturnType<typeof createSystemQueue>) {
  const id = `refresh-mv-${Date.now()}`;
  await queue.add('refresh-materialized-view', data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}

export async function enqueueCleanupLogs(data: CleanupLogsJob, queue: ReturnType<typeof createSystemQueue>) {
  const id = `cleanup-logs-${Date.now()}`;
  await queue.add('cleanup-old-logs', data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}

export async function enqueueReconcileStuckQueues(data: ReconcileStuckQueuesJob, queue: ReturnType<typeof createSystemQueue>) {
  const id = `reconcile-stuck-queues-${Date.now()}`;
  await queue.add('reconcile-stuck-queues', data, { jobId: id });
  const stored = await queue.getJob(id);
  if (!stored) throw new Error(`Job ${id} nao encontrado apos publicacao.`);
  return stored;
}