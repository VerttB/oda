import type { Job, Queue } from 'bullmq';
import { ModoExecucao, PrismaClient } from '@oda/database';
import { QUEUE_NAMES, ScrapeDgpGroupJob } from '@oda/queue';
import { publishScraperBatch, selectAvailable } from './scraperBatchPublisher';

describe('scraper batch publisher', () => {
  it('continua apos os primeiros 200 pendentes que ja estao no Redis', async () => {
    const ids = Array.from({ length: 205 }, (_, index) => String(index + 1).padStart(16, '0'));
    const queue = { getJob: jest.fn(async (jobId: string) => {
      if (Number(jobId.slice(4)) <= 200) return { getState: async () => 'waiting' };
      return null;
    }) } as unknown as Queue<ScrapeDgpGroupJob>;
    const page = jest.fn(async (after: string | undefined, size: number) => {
      const start = after ? ids.indexOf(after) + 1 : 0;
      return ids.slice(start, start + size).map(id => ({ id }));
    });
    const targets = await selectAvailable({
      queue,
      prisma: {} as PrismaClient,
      limit: 3,
      page,
      eligible: () => true,
      jobId: id => `dgp-${id}`,
      validate: () => {},
    });

    expect(targets.map(target => target.id)).toEqual(ids.slice(200, 203));
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('registra o lote com o contrato do worker e remove duplicatas do manifesto', async () => {
    let log: { id: string; metadata: Record<string, any>; dataInicio: Date } | undefined;
    const create = jest.fn(async ({ data }: any) => {
      log = { id: data.id, metadata: structuredClone(data.metadata), dataInicio: new Date() };
    });
    const update = jest.fn(async ({ data }: any) => {
      Object.assign(log!, data);
    });
    const tx = {
      $queryRaw: jest.fn(),
      pipelineLog: { findUniqueOrThrow: jest.fn(async () => log), update },
      pipelineLogItem: { findMany: jest.fn(async () => []) },
    };
    const prisma = {
      pipelineLog: { create },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    } as unknown as PrismaClient;
    const enqueue = jest.fn(async (data: ScrapeDgpGroupJob) => ({
      data: data.dgpId.endsWith('2') ? { ...data, pipelineItemId: 'existing' } : data,
    } as Job<ScrapeDgpGroupJob>));

    const result = await publishScraperBatch({
      prisma,
      queueName: QUEUE_NAMES.DGP_SCRAPER,
      mode: ModoExecucao.APENAS_DGP,
      targets: [{ id: '0000000000000001' }, { id: '0000000000000002' }],
      createJob: (target, manifest): ScrapeDgpGroupJob => ({ ...manifest, dgpId: target.id }),
      enqueue,
    });

    expect(result).toMatchObject({ enqueued: 1, duplicates: 1 });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      modulo: 'SCRAPER', modoExecucao: 'APENAS_DGP',
      metadata: expect.objectContaining({ queue: QUEUE_NAMES.DGP_SCRAPER, published: false }),
    }) });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(log!.metadata).toMatchObject({ published: true, itensFila: 1, itensDuplicados: 1 });
    expect(log!.metadata['jobs']).toHaveLength(1);
    expect(log!.metadata['jobs'][0]).toMatchObject({ dgpId: '0000000000000001', pipelineLogId: result.pipelineLogId });
    expect(update).toHaveBeenCalledWith({ where: { id: result.pipelineLogId }, data: expect.objectContaining({
      status: 'EMANDAMENTO',
    }) });
  });
});
