import { CreateLinhaPesquisaRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class CreateLinhaPesquisaDto extends createZodDto(
  CreateLinhaPesquisaRequestSchema,
) {}
