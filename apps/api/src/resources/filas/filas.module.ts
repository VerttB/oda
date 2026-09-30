import { Logger, Module } from '@nestjs/common';
import {
  createDgpScraperQueue, createDiscoveryQueue, createEtlDispatchQueue, createEtlGroupQueue,
  createEtlResearcherQueue, createLattesScraperQueue,
} from '@oda/queue';
import {
  DGP_QUEUE, DISCOVERY_QUEUE, ETL_DISPATCH_QUEUE, ETL_GROUP_QUEUE, ETL_RESEARCHER_QUEUE, LATTES_QUEUE,
} from './filas.constants';
import { FilasJwtAuthGuard } from './filas-auth.guard';
import { FilasRedisGuard } from './filas-redis.guard';
import { FilasController } from './filas.controller';
import { FilasService } from './filas.service';

@Module({
  controllers: [FilasController],
  providers: [
    FilasService,
    FilasJwtAuthGuard,
    FilasRedisGuard,
    { provide: DGP_QUEUE, useFactory: () => withErrorHandler(createDgpScraperQueue()) },
    { provide: LATTES_QUEUE, useFactory: () => withErrorHandler(createLattesScraperQueue()) },
    { provide: DISCOVERY_QUEUE, useFactory: () => withErrorHandler(createDiscoveryQueue()) },
    { provide: ETL_GROUP_QUEUE, useFactory: () => withErrorHandler(createEtlGroupQueue()) },
    { provide: ETL_RESEARCHER_QUEUE, useFactory: () => withErrorHandler(createEtlResearcherQueue()) },
    { provide: ETL_DISPATCH_QUEUE, useFactory: () => withErrorHandler(createEtlDispatchQueue()) },
  ],
})
export class FilasModule {}

const redisLogger = new Logger('FilasRedis');
let lastRedisWarningAt = 0;

function withErrorHandler<T extends { on(event: 'error', listener: (error: Error) => void): unknown }>(queue: T): T {
  queue.on('error', error => {
    const now = Date.now();
    if (now - lastRedisWarningAt < 60_000) return;
    lastRedisWarningAt = now;
    redisLogger.warn(`Conexao com Redis indisponivel: ${error.message}`);
  });
  return queue;
}
