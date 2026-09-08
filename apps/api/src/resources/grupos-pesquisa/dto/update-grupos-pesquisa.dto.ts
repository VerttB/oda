import { UpdateGruposPesquisaRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class UpdateGruposPesquisaDto extends createZodDto(
  UpdateGruposPesquisaRequestSchema,
) {}
