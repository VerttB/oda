import { ExecutionContext, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AiAccessGuard } from './ai-access.guard';
import { RedisRateLimitService } from './redis-rate-limit.service';

describe('AiAccessGuard: compatibilidade semântica', () => {
  const jwt = { verifyAsync: jest.fn() };
  const limiter = { consume: jest.fn() };
  const guard = new AiAccessGuard(jwt as unknown as JwtService, limiter as unknown as RedisRateLimitService);

  function context(path: string, query = {}, authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path, query, ip: '127.0.0.1', headers: { authorization } }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    limiter.consume.mockResolvedValue({ allowed: true, limit: 2, remaining: 1, retryAfterMs: 60_000 });
  });

  it.each([
    '/grupos-pesquisa/busca-semantica',
    '/pesquisadores/busca-semantica/',
    '/producoes/BUSCA-SEMANTICA',
    '/linha-pesquisa/busca-semantica',
  ])('aplica a mesma cota sem depender de modoBusca em %s', async path => {
    await expect(guard.canActivate(context(path))).resolves.toBe(true);
    expect(limiter.consume).toHaveBeenCalledWith('ai', 'ip:127.0.0.1', 2, 60_000);
  });

  it('alterna alias e rota atual usando a mesma identidade e bloqueia a terceira chamada', async () => {
    limiter.consume.mockResolvedValueOnce({ allowed: true, limit: 2, remaining: 1, retryAfterMs: 60_000 })
      .mockResolvedValueOnce({ allowed: true, limit: 2, remaining: 0, retryAfterMs: 60_000 })
      .mockResolvedValueOnce({ allowed: false, limit: 2, remaining: 0, retryAfterMs: 60_000 });
    await guard.canActivate(context('/producoes/busca-semantica'));
    await guard.canActivate(context('/producoes', { modoBusca: 'semantica' }));
    await expect(guard.canActivate(context('/producoes/BUSCA-SEMANTICA/'))).rejects.toBeInstanceOf(HttpException);
    expect(limiter.consume.mock.calls.every(call => call[0] === 'ai' && call[1] === 'ip:127.0.0.1')).toBe(true);
  });

  it('libera consultas textuais sem consultar Redis', async () => {
    await expect(guard.canActivate(context('/producoes', { modoBusca: 'textual' }))).resolves.toBe(true);
    expect(limiter.consume).not.toHaveBeenCalled();
  });

  it('mantém administradores autenticados sem cota nos aliases', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'admin', role: 'ADMIN' });
    await expect(guard.canActivate(context('/producoes/busca-semantica', {}, 'Bearer valido'))).resolves.toBe(true);
    expect(limiter.consume).not.toHaveBeenCalled();
  });
});
