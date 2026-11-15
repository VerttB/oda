import type { Prisma, PrismaClient } from "../generated/prisma";
type Db = Pick<PrismaClient | Prisma.TransactionClient, "$executeRaw">;

// O mesmo item representa uma execução lógica; cada entrada no processor registra uma tentativa.
export async function beginPipelineItem(
  db: Db,
  pipelineId: string,
  itemId: string,
) {
  await db.$executeRaw`
    INSERT INTO pipeline_item_execucao(id, pipeline_log_id) VALUES (${itemId}, ${pipelineId})
    ON CONFLICT (id) DO UPDATE SET ultima_tentativa_em=now(),
      tentativas=pipeline_item_execucao.tentativas+1
  `;
}
