import { FindAllGruposPesquisaQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindAllGruposPesquisaDto extends createZodDto(
  FindAllGruposPesquisaQuerySchema,
) {}
