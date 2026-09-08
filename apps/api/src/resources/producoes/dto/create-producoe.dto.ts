import { CreateProducaoRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class CreateProducoeDto extends createZodDto(
  CreateProducaoRequestSchema,
) {}
