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
  LattesJobResponseSchema,
  LattesJobsAtivosResponseSchema,
  WorkerFilaResponseSchema,
  WorkersAtivosResponseSchema,
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
