import { createZodDto } from 'nestjs-zod';
import {
  AreaConhecimentoDetalheResponseSchema,
  AreaConhecimentoResponseSchema,
  PaginatedAreaConhecimentoResponseSchema,
} from '@oda/shared-types';

export class AreaConhecimentoResponseDto extends createZodDto(
  AreaConhecimentoResponseSchema,
) {}

export class AreaConhecimentoDetalheResponseDto extends createZodDto(
  AreaConhecimentoDetalheResponseSchema,
) {}

export class PaginatedAreaConhecimentoResponseDto extends createZodDto(
  PaginatedAreaConhecimentoResponseSchema,
) {}
