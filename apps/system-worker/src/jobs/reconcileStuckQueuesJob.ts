import { PrismaClient, FilaExtracaoStatus } from '@oda/database';
import { ReconcileStuckQueuesJob, ReconcileStuckQueuesResult } from '@oda/queue';

export async function handleReconcileStuckQueuesJob(
  job: { data: ReconcileStuckQueuesJob },
  prisma: PrismaClient
): Promise<ReconcileStuckQueuesResult> {
  const staleDays = job.data.staleDays ?? 14;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - staleDays);

  try {
    const gruposAtualizados = await prisma.filaExtracaoGrupo.updateMany({
      where: {
        status: FilaExtracaoStatus.CONCLUIDO,
        ultimaAtualizacao: { lt: cutoffDate },
      },
      data: { status: FilaExtracaoStatus.PENDENTE },
    });

    const pesquisadoresAtualizados = await prisma.filaExtracaoPesquisador.updateMany({
      where: {
        status: FilaExtracaoStatus.CONCLUIDO,
        ultimaAtualizacao: { lt: cutoffDate },
      },
      data: { status: FilaExtracaoStatus.PENDENTE },
    });

    return {
      gruposRevertidos: gruposAtualizados.count,
      pesquisadoresRevertidos: pesquisadoresAtualizados.count,
    };
  } catch (error) {
    throw new Error(`Reconcile stuck queues failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export type { ReconcileStuckQueuesJob, ReconcileStuckQueuesResult } from '@oda/queue';