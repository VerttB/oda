import { UpdatePesquisadorRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class UpdatePesquisadoreDto extends createZodDto(
  UpdatePesquisadorRequestSchema,
) {}
