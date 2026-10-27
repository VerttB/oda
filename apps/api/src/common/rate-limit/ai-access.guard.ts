import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { RedisRateLimitService, RateLimitResult } from './redis-rate-limit.service';

type OptionalJwtPayload = { sub?: string; role?: string };

@Injectable()
export class AiAccessGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly rateLimitService: RedisRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (request.method === 'GET' && request.query.modoBusca !== 'semantica') return true;

    const principal = await this.getPrincipal(request);
    if (principal?.role === 'ADMIN') return true;

    const identity = principal?.sub
      ? `user:${principal.sub}`
      : `ip:${request.ip || request.socket.remoteAddress || 'unknown'}`;
    const result = await this.rateLimitService.consume('ai', identity, 2, 60_000);
    this.setRateLimitHeaders(response, result);
    if (!result.allowed) {
      response.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      throw new HttpException(
        'Limite de uso de recursos de IA: 2 requisicoes por minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private async getPrincipal(request: Request): Promise<OptionalJwtPayload | undefined> {
    const authorization = request.headers.authorization;
    if (!authorization) return undefined;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) throw new UnauthorizedException('Formato de autorizacao invalido.');

    try {
      return await this.jwtService.verifyAsync<OptionalJwtPayload>(match[1]);
    } catch {
      throw new UnauthorizedException('Token JWT invalido ou expirado.');
    }
  }

  private setRateLimitHeaders(response: Response, result: RateLimitResult) {
    response.setHeader('RateLimit-Limit', String(result.limit));
    response.setHeader('RateLimit-Remaining', String(result.remaining));
    response.setHeader('RateLimit-Reset', String(Math.ceil(result.retryAfterMs / 1000)));
  }
}
