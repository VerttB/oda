import { createZodDto } from 'nestjs-zod';
import {
  GrupoPesquisaMetricasResponseSchema,
  GruposPesquisaResponseSchema,
  PaginatedGruposPesquisaResponseSchema,
  PaginatedPesquisadorResumoResponseSchema,
} from '@oda/shared-types';

export class GrupoPesquisaResponseDto extends createZodDto(
  GruposPesquisaResponseSchema,
) {}

export class PaginatedGruposPesquisaResponseDto extends createZodDto(
  PaginatedGruposPesquisaResponseSchema,
) {}

export class PaginatedPesquisadoresGrupoResponseDto extends createZodDto(
  PaginatedPesquisadorResumoResponseSchema,
) {}

export class GrupoPesquisaMetricasResponseDto extends createZodDto(
  GrupoPesquisaMetricasResponseSchema,
) {}
