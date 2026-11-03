import { randomUUID } from 'node:crypto';
import { AiQueueJobSchema, AiQueueResultSchema } from '@oda/shared-types';
import type { AiQueueJob, AiQueueResult } from '@oda/shared-types';
import type { RedisOptions, QueueEvents } from 'bullmq';
import type { AiQueue } from './ai';
import {
  AI_JOB_NAMES,
  AI_QUEUE_SETTINGS,
  createAiQueue,
  createAiQueueEvents,
} from './ai';

export class AiQueueError extends Error {
  constructor(
    readonly reason: 'UNAVAILABLE' | 'TIMEOUT' | 'FAILED' | 'INVALID_RESULT',
  ) {
    super(`AI_QUEUE_${reason}`);
    this.name = 'AiQueueError';
  }
}

type Operation = AiQueueJob['operation'];
type Payload<T extends Operation> = Extract<
  AiQueueJob,
  { operation: T }
>['payload'];
type Result<T extends Operation> = Extract<
  AiQueueResult,
  { operation: T }
>['result'];
type ClientOptions = {
  connection?: RedisOptions;
  prefix?: string;
  waitTimeoutMs?: number;
  readinessTimeoutMs?: number;
};

async function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AiQueueError('UNAVAILABLE')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Conexões criadas sob demanda: Redis indisponível não impede o bootstrap da API. */
export class AiQueueClient {
  private resources?: { queue: AiQueue; events: QueueEvents };
  private closed = false;
  constructor(private readonly options: ClientOptions = {}) {}

  private async ready() {
    if (this.closed) throw new AiQueueError('UNAVAILABLE');
    if (!this.resources) {
      const queue = createAiQueue(this.options.connection, this.options.prefix);
      const events = createAiQueueEvents(
        this.options.connection,
        this.options.prefix,
      );
      queue.on('error', () => {
        /* Falhas são devolvidas pela operação, sem expor dados da consulta. */
      });
      events.on('error', () => {});
      // waitUntilFinished remove seus listeners ao concluir ou expirar cada espera.
      events.setMaxListeners(0);
      this.resources = { queue, events };
    }
    const { queue, events } = this.resources;
    const limit =
      this.options.readinessTimeoutMs ?? AI_QUEUE_SETTINGS.readinessTimeoutMs;
    try {
      await bounded(
        Promise.all([queue.waitUntilReady(), events.waitUntilReady()]),
        limit,
      );
      const [workers, paused] = await bounded(
        Promise.all([queue.getWorkers(), queue.isPaused()]),
        limit,
      );
      if (!workers.length || paused) throw new AiQueueError('UNAVAILABLE');
      return { queue, events };
    } catch {
      throw new AiQueueError('UNAVAILABLE');
    }
  }

  async health() {
    await this.ready();
    return {
      status: 'ok' as const,
      transport: 'bullmq',
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
    };
  }

  async request<T extends Operation>(
    operation: T,
    payload: Payload<T>,
  ): Promise<Result<T>> {
    const { queue, events } = await this.ready();
    const requestId = randomUUID();
    const timeout =
      this.options.waitTimeoutMs ?? AI_QUEUE_SETTINGS.waitTimeoutMs;
    const expiresAt = Date.now() + timeout;
    const data = AiQueueJobSchema.parse({
      version: 1,
      requestId,
      expiresAt,
      operation,
      payload,
    });
    let job: Awaited<ReturnType<typeof queue.add>>;
    try {
      job = await queue.add(AI_JOB_NAMES[operation], data, {
        jobId: `ai-${requestId}`,
      });
    } catch {
      throw new AiQueueError('UNAVAILABLE');
    }
    try {
      const raw = await job.waitUntilFinished(
        events,
        Math.max(1, expiresAt - Date.now()),
      );
      const result = AiQueueResultSchema.safeParse(raw);
      if (!result.success || result.data.operation !== operation)
        throw new AiQueueError('INVALID_RESULT');
      return result.data.result as Result<T>;
    } catch (error) {
      if (error instanceof AiQueueError) throw error;
      if (
        Date.now() >= expiresAt ||
        (error instanceof Error && error.message.includes('timed out'))
      ) {
        // remove falha se o worker já estiver executando: não anunciamos cancelamento de trabalho ativo.
        await job.remove().catch(() => {});
        throw new AiQueueError('TIMEOUT');
      }
      throw new AiQueueError('FAILED');
    }
  }

  async close() {
    this.closed = true;
    if (this.resources)
      await Promise.all([
        this.resources.events.close(),
        this.resources.queue.close(),
      ]);
  }
}
