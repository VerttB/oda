import { createZodDto } from 'nestjs-zod';
import {
  InstituicaoResponseSchema,
  InstituicaoResumoResponseSchema,
  PaginatedInstituicaoResponseSchema,
} from '@oda/shared-types';

export class InstituicaoResponseDto extends createZodDto(
  InstituicaoResponseSchema,
) {}

export class InstituicaoResumoResponseDto extends createZodDto(
  InstituicaoResumoResponseSchema,
) {}

export class PaginatedInstituicaoResponseDto extends createZodDto(
  PaginatedInstituicaoResponseSchema,
) {}
