import { FindAllInstituicaoQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindAllInstituicaoDto extends createZodDto(
  FindAllInstituicaoQuerySchema,
) {}
