import { UpdateAreaConhecimentoRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class UpdateAreaConhecimentoDto extends createZodDto(
  UpdateAreaConhecimentoRequestSchema,
) {}
