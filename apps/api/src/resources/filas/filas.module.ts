import { Logger, Module } from '@nestjs/common';
import {
  createDgpScraperQueue, createDiscoveryQueue, createEtlDispatchQueue, createEtlGroupQueue,
  createEtlResearcherQueue, createLattesScraperQueue, createSystemQueue, createAiQueue,
} from '@oda/queue';
import {
  DGP_QUEUE, DISCOVERY_QUEUE, ETL_DISPATCH_QUEUE, ETL_GROUP_QUEUE, ETL_RESEARCHER_QUEUE, LATTES_QUEUE, SYSTEM_MAINTENANCE_QUEUE, SIMCC_QUEUES,
} from './filas.constants';
import { FilasJwtAuthGuard } from './filas-auth.guard';
import { FilasRedisGuard } from './filas-redis.guard';
import { FilasController } from './filas.controller';
import { FilasService } from './filas.service';
import { FilasStatusController } from './filas-status.controller';
import { FilasCleanupController } from './filas-cleanup.controller';
import { FilasCleanupService } from './filas-cleanup.service';
import {
  AI_STATUS_QUEUE, FILAS_STATUS_QUEUES, FilasStatusService,
  type FilasStatusQueues, type QueueStatusReader,
} from './filas-status.service';

@Module({
  controllers: [FilasStatusController, FilasCleanupController, FilasController],
  providers: [
    FilasService,
    FilasStatusService,
    FilasCleanupService,
    FilasJwtAuthGuard,
    FilasRedisGuard,
    { provide: DGP_QUEUE, useFactory: () => withErrorHandler(createDgpScraperQueue()) },
    { provide: LATTES_QUEUE, useFactory: () => withErrorHandler(createLattesScraperQueue()) },
    { provide: DISCOVERY_QUEUE, useFactory: () => withErrorHandler(createDiscoveryQueue()) },
    { provide: ETL_GROUP_QUEUE, useFactory: () => withErrorHandler(createEtlGroupQueue()) },
    { provide: ETL_RESEARCHER_QUEUE, useFactory: () => withErrorHandler(createEtlResearcherQueue()) },
    { provide: ETL_DISPATCH_QUEUE, useFactory: () => withErrorHandler(createEtlDispatchQueue()) },
    { provide: SYSTEM_MAINTENANCE_QUEUE, useFactory: () => withErrorHandler(createSystemQueue()) },
    { provide: AI_STATUS_QUEUE, useFactory: () => withErrorHandler(createAiQueue()) },
    { provide: SIMCC_QUEUES, useFactory: () => ({
      dgp: withErrorHandler(createDgpScraperQueue('simcc')),
      etlGroups: withErrorHandler(createEtlGroupQueue('simcc')),
      etlDispatch: withErrorHandler(createEtlDispatchQueue('simcc')),
    }) },
    {
      provide: FILAS_STATUS_QUEUES,
      inject: [DGP_QUEUE, LATTES_QUEUE, DISCOVERY_QUEUE, ETL_GROUP_QUEUE, ETL_RESEARCHER_QUEUE,
        ETL_DISPATCH_QUEUE, SYSTEM_MAINTENANCE_QUEUE, SIMCC_QUEUES, AI_STATUS_QUEUE],
      useFactory: (
        dgp: QueueStatusReader, lattes: QueueStatusReader, discovery: QueueStatusReader,
        groups: QueueStatusReader, researchers: QueueStatusReader, dispatch: QueueStatusReader,
        system: QueueStatusReader,
        simcc: { dgp: QueueStatusReader; etlGroups: QueueStatusReader; etlDispatch: QueueStatusReader },
        ia: QueueStatusReader,
      ): FilasStatusQueues => ({
        dgp, lattes, discovery, ia,
        'etl-grupos': groups, 'etl-pesquisadores': researchers, 'etl-despacho': dispatch,
        'dgp-simcc': simcc.dgp, 'etl-grupos-simcc': simcc.etlGroups,
        'etl-despacho-simcc': simcc.etlDispatch, 'system-maintenance': system,
      }),
    },
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
