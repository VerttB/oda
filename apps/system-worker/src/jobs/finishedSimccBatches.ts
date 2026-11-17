import type { PrismaClient } from '@oda/database';
import { createEtlDispatchQueue, enqueueEtlDispatch } from '@oda/queue';
import { createHash } from 'node:crypto';

// Um UUID distinto do pipeline DGP identifica o pedido ETL em todas as tentativas.
export function simccEtlRequestId(pipelineId: string) {
  const bytes = createHash('sha256').update(`oda:simcc-etl:${pipelineId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function handleFinishedSimccBatches(prisma: PrismaClient) {
  const batches = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM pipeline_log
    WHERE data_fim IS NOT NULL AND metadata->>'scope' = 'simcc'
      AND metadata->>'simccAutoEtl' = 'pendente'
    ORDER BY data_fim, id LIMIT 20
  `;
  if (!batches.length) return { despachados: 0 };
  const queue = createEtlDispatchQueue('simcc');
  let dispatched = 0;
  try {
    for (const batch of batches) {
      await enqueueEtlDispatch({
        version: 1, requestId: simccEtlRequestId(batch.id), requestedAt: new Date().toISOString(),
        tipo: 'GRUPOS', ids: [], scope: 'simcc',
      }, queue);
      await prisma.$executeRaw`
        UPDATE pipeline_log SET metadata = jsonb_set(metadata, '{simccAutoEtl}', '"publicado"'::jsonb)
        WHERE id = ${batch.id} AND metadata->>'simccAutoEtl' = 'pendente'
      `;
      dispatched++;
    }
    return { despachados: dispatched };
  } finally {
    await queue.close();
  }
}
