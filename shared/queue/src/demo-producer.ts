import { Queue } from 'bullmq';
import { createQueueConnection } from './connection';
import { QUEUE_NAMES } from './contracts';

async function main() {
  const dgpId = process.argv[2] || '1234567890123456';
  const queue = new Queue(QUEUE_NAMES.DEMO, { connection: createQueueConnection('producer') });
  try {
  const job = await queue.add('demo', { dgpId });

  console.log('[Producer] Job adicionado ao Redis.', {
    queue: job.queueName,
    jobId: job.id,
    name: job.name,
    data: job.data,
  });
  } finally { await queue.close(); }
}

main().catch(error => {
  console.error('[Producer] Nao foi possivel adicionar o job.', error);
  process.exitCode = 1;
});
