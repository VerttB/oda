import type { Job } from 'bullmq';
import { QUEUE_NAMES, type EnqueueDgpScraperJob, type EnqueueLattesScraperJob } from '@oda/queue';
import { prisma } from '../common/database';
import { handleEnqueueDgpScraperJob } from './enqueueDgpScraperJob';
import { handleEnqueueLattesScraperJob } from './enqueueLattesScraperJob';
import { publishScraperBatch } from './scraperBatchPublisher';
import { createDgpScraperQueue, createLattesScraperQueue } from '@oda/queue';

jest.mock('../common/database', () => ({
  prisma: {
    filaExtracaoGrupo: { findMany: jest.fn() },
    filaExtracaoPesquisador: { findMany: jest.fn(), findUnique: jest.fn() },
    pipelineLog: { findFirst: jest.fn() },
  },
}));
jest.mock('@oda/queue', () => ({
  ...jest.requireActual('@oda/queue'),
  createDgpScraperQueue: jest.fn(),
  createLattesScraperQueue: jest.fn(),
}));
jest.mock('./scraperBatchPublisher', () => ({
  ...jest.requireActual('./scraperBatchPublisher'),
  publishScraperBatch: jest.fn(),
}));

describe('system worker scraper enqueue', () => {
  const queue = { getJob: jest.fn(async () => null), close: jest.fn(async () => {}) };

  beforeEach(() => {
    jest.clearAllMocks();
    (createDgpScraperQueue as jest.Mock).mockReturnValue(queue);
    (createLattesScraperQueue as jest.Mock).mockReturnValue(queue);
    (prisma.pipelineLog.findFirst as jest.Mock).mockResolvedValue(null);
    (publishScraperBatch as jest.Mock).mockResolvedValue({ pipelineLogId: 'pipeline', enqueued: 1, duplicates: 0 });
  });

  it('usa pendentes do banco e publica na fila de extracao DGP', async () => {
    (prisma.filaExtracaoGrupo.findMany as jest.Mock).mockResolvedValue([
      { dgpId: '1234567890123456', instituicao: 'Universidade do Estado da Bahia' },
    ]);

    const result = await handleEnqueueDgpScraperJob({ data: { version: 1, requestedAt: new Date().toISOString() } } as Job<EnqueueDgpScraperJob>);

    expect(result).toMatchObject({ success: true, enqueued: 1 });
    expect(prisma.filaExtracaoGrupo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'PENDENTE' },
    }));
    expect(publishScraperBatch).toHaveBeenCalledWith(expect.objectContaining({
      queueName: QUEUE_NAMES.DGP_SCRAPER,
      targets: [expect.objectContaining({ dgpId: '1234567890123456' })],
    }));
    expect(queue.close).toHaveBeenCalled();
  });

  it('enfileira pesquisadores pendentes sem exigir ID e preserva o nome do banco', async () => {
    (prisma.filaExtracaoPesquisador.findMany as jest.Mock).mockResolvedValue([
      { lattesId: '1234567890123456', nome: 'Maria da Silva' },
    ]);

    const result = await handleEnqueueLattesScraperJob({ data: { version: 1, requestedAt: new Date().toISOString() } } as Job<EnqueueLattesScraperJob>);

    expect(result).toMatchObject({ success: true, enqueued: 1 });
    expect(prisma.filaExtracaoPesquisador.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'PENDENTE' },
    }));
    const options = (publishScraperBatch as jest.Mock).mock.calls[0][0];
    expect(options.queueName).toBe(QUEUE_NAMES.LATTES_SCRAPER);
    expect(options.createJob(options.targets[0], {
      version: 1, requestedAt: '2026-01-01', pipelineLogId: 'pipeline', pipelineItemId: 'item',
    })).toMatchObject({ lattesId: '1234567890123456', nome: 'Maria da Silva' });
    expect(queue.close).toHaveBeenCalled();
  });

  it('impede o lote Lattes enquanto o scraper tradicional esta ativo', async () => {
    (prisma.filaExtracaoPesquisador.findMany as jest.Mock).mockResolvedValue([
      { lattesId: '1234567890123456', nome: 'Maria da Silva' },
    ]);
    (prisma.pipelineLog.findFirst as jest.Mock).mockResolvedValue({ id: 'legacy' });

    await expect(handleEnqueueLattesScraperJob({ data: { version: 1, requestedAt: new Date().toISOString() } } as Job<EnqueueLattesScraperJob>))
      .rejects.toThrow('scraper Lattes tradicional');
    expect(publishScraperBatch).not.toHaveBeenCalled();
    expect(queue.close).toHaveBeenCalled();
  });
});
