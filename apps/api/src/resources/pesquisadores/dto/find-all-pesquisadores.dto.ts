import { FindAllPesquisadoresQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindAllPesquisadoresDto extends createZodDto(
  FindAllPesquisadoresQuerySchema,
) {}
