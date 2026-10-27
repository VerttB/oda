import type { Job } from 'bullmq';
import { EnqueueEtlJob, createEtlDispatchQueue, enqueueEtlDispatch } from '@oda/queue';
import { randomUUID } from 'node:crypto';

export async function handleEnqueueEtlJob(job: Job<EnqueueEtlJob>) {
  const data = job.data;
  const etlDispatchQueue = createEtlDispatchQueue(data.scope);

  const requestId = randomUUID();

  try {
    const storedJob = await enqueueEtlDispatch({
      version: 1,
      requestId,
      requestedAt: new Date().toISOString(),
      tipo: data.tipo,
      ids: [],
      scope: data.scope,
    }, etlDispatchQueue);

    return {
      success: true,
      requestId,
      jobId: storedJob.id,
    };
  } finally {
    await etlDispatchQueue.close();
  }
}
