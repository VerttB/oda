import { CreateInstituicaoRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class CreateInstituicaoDto extends createZodDto(
  CreateInstituicaoRequestSchema,
) {}
