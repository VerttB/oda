import { FindAllAreaConhecimentoQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindAllAreaConhecimentoDto extends createZodDto(
  FindAllAreaConhecimentoQuerySchema,
) {}
