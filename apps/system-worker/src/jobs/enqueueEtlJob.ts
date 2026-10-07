import { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES, DataScope, EtlDispatchType } from '@oda/queue';
import { createEtlDispatchQueue, enqueueEtlDispatch } from '@oda/queue';

export async function handleEnqueueEtlJob(job: any): Promise<any> {
  const data = job.data as {
    version: 1;
    requestedAt: string;
    tipo: 'TODOS' | 'GRUPOS' | 'PESQUISADORES';
    scope: DataScope;
  };

  const etlDispatchQueue = createEtlDispatchQueue();
  
  // Generate a request ID for this ETL dispatch
  const requestId = `etl-scheduled-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Enqueue the ETL dispatch job
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
}