import { FindAllProducoesQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindAllProducoesDto extends createZodDto(
  FindAllProducoesQuerySchema,
) {}
