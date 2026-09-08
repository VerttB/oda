import { UpdateLinhaPesquisaRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class UpdateLinhaPesquisaDto extends createZodDto(
  UpdateLinhaPesquisaRequestSchema,
) {}
