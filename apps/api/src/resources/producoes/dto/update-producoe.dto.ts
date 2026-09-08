import { UpdateProducaoRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class UpdateProducoeDto extends createZodDto(
  UpdateProducaoRequestSchema,
) {}
