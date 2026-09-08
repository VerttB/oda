import { UpdateInstituicaoRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class UpdateInstituicaoDto extends createZodDto(
  UpdateInstituicaoRequestSchema,
) {}
