import { CreateAreaConhecimentoRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class CreateAreaConhecimentoDto extends createZodDto(
  CreateAreaConhecimentoRequestSchema,
) {}
