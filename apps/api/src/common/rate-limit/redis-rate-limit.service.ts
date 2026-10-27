import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@keyv/redis';
import { createHash } from 'node:crypto';

const INCREMENT_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return { current, redis.call('PTTL', KEYS[1]) }
`;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
}

@Injectable()
export class RedisRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitService.name);
  private client?: any;
  private connecting?: Promise<any>;
  private lastWarningAt = 0;

  constructor(private readonly configService: ConfigService) {}

  async consume(
    scope: string,
    identity: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    try {
      const client = await this.getClient();
      const identityHash = createHash('sha256').update(identity).digest('hex');
      const key = `oda:rate-limit:${scope}:${identityHash}`;
      const result = await client.eval(INCREMENT_WINDOW_SCRIPT, {
        keys: [key],
        arguments: [String(windowMs)],
      }) as number[];
      const count = Number(result[0]);
      const retryAfterMs = Math.max(0, Number(result[1]));

      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        retryAfterMs,
      };
    } catch (error) {
      const now = Date.now();
      if (now - this.lastWarningAt > 60_000) {
        this.lastWarningAt = now;
        this.logger.warn(`Redis indisponivel para limitacao de requisicoes: ${String(error)}`);
      }
      throw new ServiceUnavailableException(
        'Operacao temporariamente indisponivel: o limitador de requisicoes nao pode ser consultado.',
      );
    }
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) await this.client.quit();
  }

  private async getClient() {
    if (this.client?.isReady) return this.client;
    if (this.connecting) return this.connecting;

    const redisUrl = this.configService.get<string>('REDIS_URL')
      ?? `redis://${this.configService.get<string>('REDIS_HOST', 'localhost')}:${this.configService.get<string>('REDIS_PORT', '6379')}`;
    const client = createClient({
      url: redisUrl,
      disableOfflineQueue: true,
      socket: { connectTimeout: 1500, reconnectStrategy: () => false },
    });
    client.on('error', (error) => {
      const now = Date.now();
      if (now - this.lastWarningAt > 60_000) {
        this.lastWarningAt = now;
        this.logger.warn(`Conexao do limitador Redis: ${error.message}`);
      }
    });

    this.connecting = client.connect()
      .then(() => {
        this.client = client;
        return client;
      })
      .catch(async (error) => {
        client.destroy();
        throw error;
      })
      .finally(() => {
        this.connecting = undefined;
      });

    return this.connecting;
  }
}
