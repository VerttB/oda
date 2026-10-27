import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RedisRateLimitService } from './redis-rate-limit.service';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RedisRateLimitService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const result = await this.rateLimitService.consume(
      'login',
      request.ip || request.socket.remoteAddress || 'unknown',
      5,
      15 * 60_000,
    );

    response.setHeader('RateLimit-Limit', String(result.limit));
    response.setHeader('RateLimit-Remaining', String(result.remaining));
    response.setHeader('RateLimit-Reset', String(Math.ceil(result.retryAfterMs / 1000)));
    if (!result.allowed) {
      response.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      throw new HttpException(
        'Muitas tentativas de login. Tente novamente mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
