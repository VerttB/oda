import { PrismaClient } from '@oda/database';
import { RefreshMvJob, RefreshMvResult } from '@oda/queue';

export async function handleRefreshMvJob(
  job: { data: RefreshMvJob },
  prisma: PrismaClient
): Promise<RefreshMvResult> {
  const { concurrently = true } = job.data;
  const startTime = Date.now();

  try {
    const sql = concurrently
      ? 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_metricas_sistema'
      : 'REFRESH MATERIALIZED VIEW mv_metricas_sistema';

    await prisma.$executeRawUnsafe(sql);

    return {
      success: true,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type { RefreshMvJob, RefreshMvResult } from '@oda/queue';