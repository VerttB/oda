import { createEtlDispatchQueue, enqueueEtlDispatch } from '@oda/queue';
import { handleFinishedSimccBatches, simccEtlRequestId } from './finishedSimccBatches';

jest.mock('@oda/queue', () => ({
  ...jest.requireActual('@oda/queue'),
  createEtlDispatchQueue: jest.fn(), enqueueEtlDispatch: jest.fn(),
}));

it('despacha lote encerrado com identificador estável e distinto do pipeline', async () => {
  const pipelineId = '11111111-1111-4111-8111-111111111111';
  const db = { $queryRaw: jest.fn().mockResolvedValue([{ id: pipelineId }]), $executeRaw: jest.fn().mockResolvedValue(1) };
  const queue = { close: jest.fn().mockResolvedValue(undefined) };
  (createEtlDispatchQueue as jest.Mock).mockReturnValue(queue);
  (enqueueEtlDispatch as jest.Mock).mockResolvedValue({});
  await handleFinishedSimccBatches(db as any);
  const requestId = simccEtlRequestId(pipelineId);
  expect(requestId).not.toBe(pipelineId);
  expect(simccEtlRequestId(pipelineId)).toBe(requestId);
  expect(enqueueEtlDispatch).toHaveBeenCalledWith(expect.objectContaining({ requestId, scope: 'simcc', tipo: 'GRUPOS' }), queue);
  expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  expect(queue.close).toHaveBeenCalled();
});

it('não marca publicação quando o Redis falha', async () => {
  const db = { $queryRaw: jest.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]), $executeRaw: jest.fn() };
  const queue = { close: jest.fn().mockResolvedValue(undefined) };
  (createEtlDispatchQueue as jest.Mock).mockReturnValue(queue);
  (enqueueEtlDispatch as jest.Mock).mockRejectedValueOnce(new Error('Redis indisponível'));
  await expect(handleFinishedSimccBatches(db as any)).rejects.toThrow('Redis indisponível');
  expect(db.$executeRaw).not.toHaveBeenCalled();
  expect(queue.close).toHaveBeenCalled();
});
