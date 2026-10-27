import type { Job } from 'bullmq';
import { createEtlDispatchQueue, enqueueEtlDispatch, EnqueueEtlJob } from '@oda/queue';
import { handleEnqueueEtlJob } from './enqueueEtlJob';

jest.mock('@oda/queue', () => ({
  ...jest.requireActual('@oda/queue'),
  createEtlDispatchQueue: jest.fn(),
  enqueueEtlDispatch: jest.fn(),
}));

describe('despacho ETL por escopo', () => {
  for (const scope of ['default', 'simcc'] as const) {
    it(`publica no servidor ${scope} e fecha a conexao`, async () => {
      const queue = { close: jest.fn(async () => {}) };
      (createEtlDispatchQueue as jest.Mock).mockReturnValue(queue);
      (enqueueEtlDispatch as jest.Mock).mockResolvedValue({ id: 'job' });
      const result = await handleEnqueueEtlJob({ data: {
        version: 1, requestedAt: new Date().toISOString(), tipo: 'GRUPOS', scope,
      } } as Job<EnqueueEtlJob>);
      expect(createEtlDispatchQueue).toHaveBeenLastCalledWith(scope);
      expect(enqueueEtlDispatch).toHaveBeenLastCalledWith(expect.objectContaining({ scope }), queue);
      expect(result.jobId).toBe('job');
      expect(queue.close).toHaveBeenCalledTimes(1);
    });
  }

  it('fecha a conexao mesmo quando a publicacao falha', async () => {
    const queue = { close: jest.fn(async () => {}) };
    (createEtlDispatchQueue as jest.Mock).mockReturnValue(queue);
    (enqueueEtlDispatch as jest.Mock).mockRejectedValue(new Error('Redis indisponivel'));
    await expect(handleEnqueueEtlJob({ data: { scope: 'simcc', tipo: 'GRUPOS' } } as Job<EnqueueEtlJob>))
      .rejects.toThrow('Redis indisponivel');
    expect(queue.close).toHaveBeenCalledTimes(1);
  });
});
