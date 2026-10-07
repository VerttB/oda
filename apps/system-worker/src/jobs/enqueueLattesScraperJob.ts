import { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES, DataScope } from '@oda/queue';
import { createLattesScraperQueue, enqueueLattesResearcher } from '@oda/queue';
import { lattesJobId } from '@oda/queue';
import { v4 as uuidv4 } from 'uuid';

export async function handleEnqueueLattesScraperJob(job: any): Promise<any> {
  const data = job.data as {
    version: 1;
    requestedAt: string;
    lattesId?: string;
  };

  const lattesScraperQueue = createLattesScraperQueue();
  
  // If lattesId is provided, enqueue that specific researcher
  if (data.lattesId) {
    const pipelineLogId = uuidv4();
    const pipelineItemId = uuidv4();
    
    const storedJob = await enqueueLattesResearcher({
      version: 1,
      requestedAt: new Date().toISOString(),
      lattesId: data.lattesId,
      nome: 'Scheduled Lattes Researcher',
      pipelineLogId,
      pipelineItemId,
    }, lattesScraperQueue);

    return {
      success: true,
      jobId: storedJob.id,
      lattesId: data.lattesId,
    };
  }

  // If no specific lattesId, return success but no job enqueued
  // This would need a discovery step to find researchers to scrape
  return {
    success: true,
    message: 'No lattesId provided, skipping enqueue',
  };
}