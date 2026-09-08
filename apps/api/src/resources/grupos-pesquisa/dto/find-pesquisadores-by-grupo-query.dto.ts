import { FindPesquisadoresByGrupoQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindPesquisadoresByGrupoQueryDto extends createZodDto(
  FindPesquisadoresByGrupoQuerySchema,
) {}
