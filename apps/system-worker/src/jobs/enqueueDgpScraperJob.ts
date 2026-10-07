import { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES, DataScope } from '@oda/queue';
import { createDiscoveryQueue, enqueueDiscoveryKey } from '@oda/queue';
import { v4 as uuidv4 } from 'uuid';

export async function handleEnqueueDgpScraperJob(job: any): Promise<any> {
  const data = job.data as {
    version: 1;
    requestedAt: string;
    scope?: 'default' | 'simcc';
  };

  // Generate required pipeline IDs
  const pipelineLogId = uuidv4();
  const pipelineItemId = uuidv4();

  // Enqueue discovery job for all groups (chave = "todos" para todos os grupos)
  const storedJob = await enqueueDiscoveryKey({
    version: 1,
    requestedAt: new Date().toISOString(),
    chave: 'todos',
    uf: undefined,
    pipelineLogId,
    pipelineItemId,
  }, createDiscoveryQueue());

  return {
    success: true,
    jobId: storedJob.id,
    discoveryJobId: storedJob.id,
  };
}