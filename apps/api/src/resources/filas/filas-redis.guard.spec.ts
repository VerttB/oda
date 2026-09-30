import { ServiceUnavailableException } from '@nestjs/common';
import { createDgpScraperQueue } from '@oda/queue';
import { FilasRedisGuard } from './filas-redis.guard';

describe('FilasRedisGuard', () => {
  const queue = { getWorkers: jest.fn() };
  const guard = new FilasRedisGuard(queue as unknown as ReturnType<typeof createDgpScraperQueue>);

  beforeEach(() => queue.getWorkers.mockReset());

  it('libera consultas quando o Redis responde', async () => {
    queue.getWorkers.mockResolvedValue([]);
    await expect(guard.canActivate()).resolves.toBe(true);
  });

  it('retorna 503 quando o Redis recusa a conexao', async () => {
    queue.getWorkers.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(guard.canActivate()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('retorna 503 quando a conexao fica pendente', async () => {
    jest.useFakeTimers();
    try {
      queue.getWorkers.mockReturnValue(new Promise(() => {}));
      const result = expect(guard.canActivate()).rejects.toBeInstanceOf(ServiceUnavailableException);
      await jest.advanceTimersByTimeAsync(2000);
      await result;
    } finally {
      jest.useRealTimers();
    }
  });
});
