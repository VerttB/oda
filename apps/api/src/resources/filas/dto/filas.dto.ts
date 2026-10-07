import {
  DgpJobResponseSchema,
  DgpJobsAtivosResponseSchema,
  DiscoveryJobResponseSchema,
  DiscoveryJobsAtivosResponseSchema,
  EnfileirarDiscoveryRequestSchema,
  EnfileirarDiscoveryResponseSchema,
  EnfileirarDgpRequestSchema,
  EnfileirarDgpResponseSchema,
  EnfileirarLattesRequestSchema,
  EnfileirarLattesResponseSchema,
  EtlGroupJobResponseSchema,
  EtlGroupJobsAtivosResponseSchema,
  EtlResearcherJobResponseSchema,
  EtlResearcherJobsAtivosResponseSchema,
  ConsultarFilaJobsRequestSchema,
  EnfileirarEtlRequestSchema,
  EnfileirarEtlResponseSchema,
  EtlDispatchJobResponseSchema,
  FilaJobsResponseSchema,
  FilaParamSchema,
  FilaResumoResponseSchema,
  LattesJobResponseSchema,
  LattesJobsAtivosResponseSchema,
  WorkerFilaResponseSchema,
  WorkersAtivosResponseSchema,
  EnfileirarBackupDbRequestSchema,
  EnfileirarBackupDbResponseSchema,
  EnfileirarRefreshMvRequestSchema,
  EnfileirarRefreshMvResponseSchema,
  EnfileirarCleanupLogsRequestSchema,
  EnfileirarCleanupLogsResponseSchema,
  EnfileirarReconcileStuckQueuesRequestSchema,
  EnfileirarReconcileStuckQueuesResponseSchema,
  SystemMaintenanceJobStatusSchema,
  SystemMaintenanceJobsAtivosResponseSchema,
  EnfileirarEnqueueEtlRequestSchema,
  EnfileirarEnqueueEtlResponseSchema,
  EnfileirarEnqueueDgpScraperRequestSchema,
  EnfileirarEnqueueDgpScraperResponseSchema,
  EnfileirarEnqueueLattesScraperRequestSchema,
  EnfileirarEnqueueLattesScraperResponseSchema,
} from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class EnfileirarDgpDto extends createZodDto(EnfileirarDgpRequestSchema) {}
export class EnfileirarDgpResponseDto extends createZodDto(EnfileirarDgpResponseSchema) {}
export class WorkerFilaResponseDto extends createZodDto(WorkerFilaResponseSchema) {}
export class WorkersAtivosResponseDto extends createZodDto(WorkersAtivosResponseSchema) {}
export class DgpJobResponseDto extends createZodDto(DgpJobResponseSchema) {}
export class DgpJobsAtivosResponseDto extends createZodDto(DgpJobsAtivosResponseSchema) {}
export class EnfileirarLattesDto extends createZodDto(EnfileirarLattesRequestSchema) {}
export class EnfileirarLattesResponseDto extends createZodDto(EnfileirarLattesResponseSchema) {}
export class LattesJobResponseDto extends createZodDto(LattesJobResponseSchema) {}
export class LattesJobsAtivosResponseDto extends createZodDto(LattesJobsAtivosResponseSchema) {}
export class EnfileirarDiscoveryDto extends createZodDto(EnfileirarDiscoveryRequestSchema) {}
export class EnfileirarDiscoveryResponseDto extends createZodDto(EnfileirarDiscoveryResponseSchema) {}
export class DiscoveryJobResponseDto extends createZodDto(DiscoveryJobResponseSchema) {}
export class DiscoveryJobsAtivosResponseDto extends createZodDto(DiscoveryJobsAtivosResponseSchema) {}
export class EtlGroupJobResponseDto extends createZodDto(EtlGroupJobResponseSchema) {}
export class EtlGroupJobsAtivosResponseDto extends createZodDto(EtlGroupJobsAtivosResponseSchema) {}
export class EtlResearcherJobResponseDto extends createZodDto(EtlResearcherJobResponseSchema) {}
export class EtlResearcherJobsAtivosResponseDto extends createZodDto(EtlResearcherJobsAtivosResponseSchema) {}
export class EnfileirarEtlDto extends createZodDto(EnfileirarEtlRequestSchema) {}
export class EnfileirarEtlResponseDto extends createZodDto(EnfileirarEtlResponseSchema) {}
export class EtlDispatchJobResponseDto extends createZodDto(EtlDispatchJobResponseSchema) {}
export class FilaParamDto extends createZodDto(FilaParamSchema) {}
export class ConsultarFilaJobsDto extends createZodDto(ConsultarFilaJobsRequestSchema) {}
export class FilaResumoResponseDto extends createZodDto(FilaResumoResponseSchema) {}
export class FilaJobsResponseDto extends createZodDto(FilaJobsResponseSchema) {}

export class EnfileirarBackupDbDto extends createZodDto(EnfileirarBackupDbRequestSchema) {}
export class EnfileirarBackupDbResponseDto extends createZodDto(EnfileirarBackupDbResponseSchema) {}
export class EnfileirarRefreshMvDto extends createZodDto(EnfileirarRefreshMvRequestSchema) {}
export class EnfileirarRefreshMvResponseDto extends createZodDto(EnfileirarRefreshMvResponseSchema) {}
export class EnfileirarCleanupLogsDto extends createZodDto(EnfileirarCleanupLogsRequestSchema) {}
export class EnfileirarCleanupLogsResponseDto extends createZodDto(EnfileirarCleanupLogsResponseSchema) {}
export class EnfileirarReconcileStuckQueuesDto extends createZodDto(EnfileirarReconcileStuckQueuesRequestSchema) {}
export class EnfileirarReconcileStuckQueuesResponseDto extends createZodDto(EnfileirarReconcileStuckQueuesResponseSchema) {}
export class SystemMaintenanceJobStatusDto extends createZodDto(SystemMaintenanceJobStatusSchema) {}
export class SystemMaintenanceJobsAtivosResponseDto extends createZodDto(SystemMaintenanceJobsAtivosResponseSchema) {}

export class EnfileirarEnqueueEtlDto extends createZodDto(EnfileirarEnqueueEtlRequestSchema) {}
export class EnfileirarEnqueueEtlResponseDto extends createZodDto(EnfileirarEnqueueEtlResponseSchema) {}
export class EnfileirarEnqueueDgpScraperDto extends createZodDto(EnfileirarEnqueueDgpScraperRequestSchema) {}
export class EnfileirarEnqueueDgpScraperResponseDto extends createZodDto(EnfileirarEnqueueDgpScraperResponseSchema) {}
export class EnfileirarEnqueueLattesScraperDto extends createZodDto(EnfileirarEnqueueLattesScraperRequestSchema) {}
export class EnfileirarEnqueueLattesScraperResponseDto extends createZodDto(EnfileirarEnqueueLattesScraperResponseSchema) {}