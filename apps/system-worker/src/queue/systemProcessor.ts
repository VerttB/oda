import { Job } from 'bullmq';
import { PrismaClient } from '@oda/database';
import { JOB_NAMES } from '@oda/queue';
import { handleBackupDbJob } from '../jobs/backupDbJob';
import { handleRefreshMvJob } from '../jobs/refreshMvJob';
import { handleCleanupLogsJob } from '../jobs/cleanupLogsJob';
import { handleReconcileStuckQueuesJob } from '../jobs/reconcileStuckQueuesJob';
import { prisma } from '../common/database';

export async function systemProcessor(job: Job): Promise<any> {
  switch (job.name) {
    case JOB_NAMES.BACKUP_DB:
      return handleBackupDbJob(job as any);

    case JOB_NAMES.REFRESH_MV:
      return handleRefreshMvJob(job as any, prisma);

    case JOB_NAMES.CLEANUP_LOGS:
      return handleCleanupLogsJob(job as any, prisma);

    case JOB_NAMES.RECONCILE_STUCK_QUEUES:
      return handleReconcileStuckQueuesJob(job as any, prisma);

    default:
      throw new Error(`Job desconhecido: ${job.name}`);
  }
}