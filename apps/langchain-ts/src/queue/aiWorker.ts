import dotenv from 'dotenv';
import path from 'node:path';
import { hostname } from 'node:os';
import {
  AI_QUEUE_SETTINGS,
  QUEUE_NAMES,
  Worker,
  createQueueConnection,
  createAiQueue,
} from '@oda/queue';
import type { AiExecutor } from './aiProcessor';
import { createAiProcessor } from './aiProcessor';
import type { AiQueueJob, AiQueueResult } from '@oda/shared-types';

export function createAiWorker(execute: AiExecutor) {
  return new Worker<AiQueueJob, AiQueueResult>(
    QUEUE_NAMES.AI,
    createAiProcessor(execute),
    {
      connection: createQueueConnection('worker'),
      name: `ai-${hostname()}-${process.pid}`,
      concurrency: AI_QUEUE_SETTINGS.concurrency,
      maxStalledCount: 1,
      autorun: false,
    },
  );
}

async function main() {
  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
  const missing = ['OPEN_AI_KEY', 'DATABASE_URL'].filter(
    (key) => !process.env[key]?.trim(),
  );
  if (missing.length) {
    console.error('[IA Worker] Variáveis obrigatórias não configuradas.', {
      variaveis: missing,
    });
    process.exitCode = 1;
    return;
  }
  const { executeAiJob } =
    require('./aiExecutor') as typeof import('./aiExecutor');
  const { prisma } = require('../core/db') as typeof import('../core/db');
  const queue = createAiQueue();
  queue.on('error', () =>
    console.error('[IA Worker] Falha na conexão de gerenciamento.'),
  );
  const worker = createAiWorker(executeAiJob);
  let closing: Promise<void> | undefined;
  const shutdown = () => {
    closing ??= worker.close();
    return closing;
  };
  worker.on('completed', (job) =>
    console.log('[IA Worker] Concluído.', {
      jobId: job.id,
      operation: job.data.operation,
    }),
  );
  worker.on('failed', (job, error) =>
    console.error('[IA Worker] Falha.', {
      jobId: job?.id,
      operation: job?.data.operation,
      errorType: error.name,
    }),
  );
  worker.on('stalled', (jobId) =>
    console.warn('[IA Worker] Execução interrompida; verificando retomada.', {
      jobId,
    }),
  );
  worker.on('error', () =>
    console.error('[IA Worker] Falha de conexão com a fila.'),
  );
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  try {
    await queue.waitUntilReady();
    await queue.setGlobalConcurrency(AI_QUEUE_SETTINGS.concurrency);
    console.log('[IA Worker] Aguardando consultas.', {
      fila: QUEUE_NAMES.AI,
      concorrencia: AI_QUEUE_SETTINGS.concurrency,
    });
    await worker.run();
  } finally {
    process.off('SIGTERM', shutdown);
    process.off('SIGINT', shutdown);
    await shutdown();
    await queue.close();
    await prisma.$disconnect();
  }
}

if (require.main === module)
  void main().catch((error) => {
    console.error('[IA Worker] Não foi possível iniciar.', {
      errorType: error.name,
    });
    process.exitCode = 1;
  });
