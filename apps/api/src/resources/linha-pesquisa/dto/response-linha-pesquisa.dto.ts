import { createZodDto } from 'nestjs-zod';
import {
  LinhaPesquisaResponseSchema,
  PaginatedLinhaPesquisaResponseSchema,
} from '@oda/shared-types';

export class LinhaPesquisaResponseDto extends createZodDto(
  LinhaPesquisaResponseSchema,
) {}

export class PaginatedLinhaPesquisaResponseDto extends createZodDto(
  PaginatedLinhaPesquisaResponseSchema,
) {}
