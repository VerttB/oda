import { createZodDto } from 'nestjs-zod';
import {
  PaginatedProducaoResponseSchema,
  ProducaoResponseSchema,
} from '@oda/shared-types';

export class ProducaoResponseDto extends createZodDto(
  ProducaoResponseSchema,
) {}

export class PaginatedProducaoResponseDto extends createZodDto(
  PaginatedProducaoResponseSchema,
) {}
