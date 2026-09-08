import { CreateGruposPesquisaRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class CreateGruposPesquisaDto extends createZodDto(
  CreateGruposPesquisaRequestSchema,
) {}
