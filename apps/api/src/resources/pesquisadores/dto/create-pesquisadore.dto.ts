import { CreatePesquisadorRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class CreatePesquisadoreDto extends createZodDto(
  CreatePesquisadorRequestSchema,
) {}
