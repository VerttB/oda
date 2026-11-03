import { Queue, QueueEvents } from 'bullmq';
import { EventEmitter } from 'node:events';
import type { RedisOptions } from 'bullmq';
import type { AiQueueJob, AiQueueResult } from '@oda/shared-types';
import { createQueueConnection } from './connection';
import { QUEUE_NAMES } from './contracts';

export const AI_JOB_NAMES = {
  generate: 'ai-generate',
  summarize: 'ai-summarize',
  'semantic-search': 'ai-semantic-search',
} as const;

export const AI_QUEUE_SETTINGS = {
  concurrency: 1,
  waitTimeoutMs: 120_000,
  readinessTimeoutMs: 2_000,
} as const;

// O cliente HTTP precisa encerrar mesmo se o Redis nunca chegou a conectar.
// O fechamento padrão de QueueEvents aguarda a conexão ficar pronta.
export class AiQueue extends Queue<AiQueueJob, AiQueueResult, string> {
  override async close() {
    if (!this.closing) {
      EventEmitter.prototype.emit.call(this, 'closing', 'closing queue');
      this.closing = this.connection.close(true);
    }
    await this.closing;
    this.closed = true;
  }
}

class AiQueueEvents extends QueueEvents {
  override async close() {
    this.closing ??= this.connection.close(true);
    await this.closing;
    this.closed = true;
  }
}
export function createAiQueue(
  connection?: RedisOptions,
  prefix?: string,
): AiQueue {
  return new AiQueue(QUEUE_NAMES.AI, {
    connection: connection ?? {
      ...createQueueConnection('producer'),
      enableOfflineQueue: false,
      commandTimeout: 2_000,
    },
    ...(prefix === undefined ? {} : { prefix }),
    defaultJobOptions: {
      // Repetir automaticamente uma geração pode duplicar chamadas cobradas pelo provedor.
      attempts: 1,
      removeOnComplete: { age: 300, count: 100 },
      removeOnFail: { age: 300, count: 100 },
      sizeLimit: 128 * 1024,
    },
    streams: { events: { maxLen: 1_000 } },
  });
}

export function createAiQueueEvents(
  connection?: RedisOptions,
  prefix?: string,
) {
  return new AiQueueEvents(QUEUE_NAMES.AI, {
    connection: connection
      ? {
          ...connection,
          maxRetriesPerRequest: null,
          commandTimeout: undefined,
          enableOfflineQueue: true,
        }
      : createQueueConnection('worker'),
    ...(prefix === undefined ? {} : { prefix }),
    blockingTimeout: 1_000,
  });
}
