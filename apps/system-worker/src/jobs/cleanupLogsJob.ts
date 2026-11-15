import { PrismaClient, retainPipelineHistory } from '@oda/database';
import { CleanupLogsJob, CleanupLogsResult } from '@oda/queue';

export async function handleCleanupLogsJob(
  job: { data: CleanupLogsJob },
  prisma: PrismaClient
): Promise<CleanupLogsResult> {
  const retentionDays = job.data.retentionDays ?? 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    let deleted = 0;
    // Limite de trabalho por manutenção; as próximas execuções continuam a limpeza.
    for (let batch = 0; batch < 10; batch++) {
      const count = await retainPipelineHistory(prisma, cutoffDate);
      deleted += count;
      if (count < 100) break;
    }

    return {
      pipelineLogDeleted: deleted,
    };
  } catch (error) {
    throw new Error(`Cleanup logs failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export type { CleanupLogsJob, CleanupLogsResult } from '@oda/queue';
