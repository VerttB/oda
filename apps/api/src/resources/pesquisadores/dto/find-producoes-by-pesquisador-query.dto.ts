import { FindProducoesByPesquisadorQuerySchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class FindProducoesByPesquisadorQueryDto extends createZodDto(
  FindProducoesByPesquisadorQuerySchema,
) {}
