import { PrismaClient } from '@oda/database';
import { CleanupLogsJob, CleanupLogsResult } from '@oda/queue';

export async function handleCleanupLogsJob(
  job: { data: CleanupLogsJob },
  prisma: PrismaClient
): Promise<CleanupLogsResult> {
  const retentionDays = job.data.retentionDays ?? 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const result = await prisma.pipelineLog.deleteMany({
      where: {
        criadoEm: { lt: cutoffDate },
      },
    });

    return {
      pipelineLogDeleted: result.count,
    };
  } catch (error) {
    throw new Error(`Cleanup logs failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export type { CleanupLogsJob, CleanupLogsResult } from '@oda/queue';