import { createZodDto } from 'nestjs-zod';
import {
  PaginatedPesquisadorResponseSchema,
  PaginatedProducaoResponseSchema,
  PesquisadorMetricasResponseSchema,
  PesquisadorResponseSchema,
} from '@oda/shared-types';

export class PesquisadorResponseDto extends createZodDto(
  PesquisadorResponseSchema,
) {}

export class PaginatedPesquisadorResponseDto extends createZodDto(
  PaginatedPesquisadorResponseSchema,
) {}

export class PesquisadorMetricasResponseDto extends createZodDto(
  PesquisadorMetricasResponseSchema,
) {}

export class PaginatedProducoesPesquisadorResponseDto extends createZodDto(
  PaginatedProducaoResponseSchema,
) {}
