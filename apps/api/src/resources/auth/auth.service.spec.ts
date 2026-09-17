import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwt = { sign: jest.fn().mockReturnValue('token-assinado') };

  it('gera token com as credenciais administrativas configuradas', async () => {
    const config = { get: jest.fn((key: string, fallback?: string) => ({
      ADMIN_USERNAME: 'gestor', ADMIN_PASSWORD: 'senha-segura',
    })[key] ?? fallback) };
    const service = new AuthService(jwt as any, config as any);

    await expect(service.login({ username: 'gestor', password: 'senha-segura' }))
      .resolves.toEqual({ access_token: 'token-assinado' });
    expect(jwt.sign).toHaveBeenCalledWith({ username: 'gestor', sub: 'admin-id' });
  });

  it('recusa credenciais erradas ou senha administrativa não configurada', async () => {
    const configured = new AuthService(jwt as any, {
      get: (key: string, fallback?: string) => ({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'correta' })[key] ?? fallback,
    } as any);
    await expect(configured.login({ username: 'admin', password: 'errada' }))
      .rejects.toBeInstanceOf(UnauthorizedException);

    const missingPassword = new AuthService(jwt as any, {
      get: (_key: string, fallback?: string) => fallback,
    } as any);
    await expect(missingPassword.login({ username: 'admin', password: 'qualquer' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
