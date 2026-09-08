import { createZodDto } from 'nestjs-zod';
import {
  MetricasAreasConhecimentoResponseSchema,
  MetricasGeraisResponseSchema,
  MetricasGruposPesquisaResponseSchema,
  MetricasInstituicoesResponseSchema,
  MetricasPesquisadoresResponseSchema,
  MetricasProducoesResponseSchema,
} from '@oda/shared-types';

export class MetricasGeraisResponseDto extends createZodDto(
  MetricasGeraisResponseSchema,
) {}

export class MetricasGruposPesquisaResponseDto extends createZodDto(
  MetricasGruposPesquisaResponseSchema,
) {}

export class MetricasPesquisadoresResponseDto extends createZodDto(
  MetricasPesquisadoresResponseSchema,
) {}

export class MetricasAreasConhecimentoResponseDto extends createZodDto(
  MetricasAreasConhecimentoResponseSchema,
) {}

export class MetricasProducoesResponseDto extends createZodDto(
  MetricasProducoesResponseSchema,
) {}

export class MetricasInstituicoesResponseDto extends createZodDto(
  MetricasInstituicoesResponseSchema,
) {}
