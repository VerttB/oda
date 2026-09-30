import { CanActivate, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createDgpScraperQueue } from '@oda/queue';
import { DGP_QUEUE } from './filas.constants';

@Injectable()
export class FilasRedisGuard implements CanActivate {
  constructor(@Inject(DGP_QUEUE) private readonly queue: ReturnType<typeof createDgpScraperQueue>) {}

  async canActivate(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.queue.getWorkers(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Redis timeout')), 2000);
        }),
      ]);
      return true;
    } catch {
      throw new ServiceUnavailableException('Filas temporariamente indisponiveis: Redis fora do ar.');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
