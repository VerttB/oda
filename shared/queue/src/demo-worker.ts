import { Worker } from 'bullmq';
import { createQueueConnection } from './connection';
import { QUEUE_NAMES } from './contracts';

const worker = new Worker<{ dgpId: string }, { dgpId: string; simulated: boolean }>(
  QUEUE_NAMES.DEMO,
  async job => {
    console.log('[Worker] Job recebido.', { jobId: job.id, name: job.name, data: job.data });

    if (job.name !== 'demo') {
      throw new Error(`Tipo de job desconhecido: ${job.name}`);
    }

    await job.updateProgress(50);
    await new Promise(resolve => setTimeout(resolve, 1_000));
    await job.updateProgress(100);

    // Nesta primeira etapa simulamos a chamada do scraper.
    return { dgpId: job.data.dgpId, simulated: true };
  },
  { connection: createQueueConnection('worker'), concurrency: 1 },
);

worker.on('progress', (job, progress) => {
  console.log('[Worker] Progresso atualizado.', { jobId: job.id, progress });
});
worker.on('completed', (job, result) => {
  console.log('[Worker] Job concluido.', { jobId: job.id, result });
});
worker.on('failed', (job, error) => {
  console.error('[Worker] Tentativa falhou.', { jobId: job?.id, attemptsMade: job?.attemptsMade, error: error.message });
});
worker.on('error', error => {
  console.error('[Worker] Erro da conexao ou do worker.', error);
});

async function shutdown(signal: string) {
  console.log(`[Worker] Encerrando apos ${signal}...`);
  await worker.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

async function main() {
  await worker.waitUntilReady();
  console.log(`[Worker] Aguardando jobs em "${QUEUE_NAMES.DEMO}". Use Ctrl+C para encerrar.`);
}

main().catch(error => {
  console.error('[Worker] Nao foi possivel iniciar.', error);
  process.exitCode = 1;
});
