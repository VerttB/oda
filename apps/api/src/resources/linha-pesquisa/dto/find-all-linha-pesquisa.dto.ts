import { FindAllLinhaPesquisaQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindAllLinhaPesquisaDto extends createZodDto(
  FindAllLinhaPesquisaQuerySchema,
) {}
