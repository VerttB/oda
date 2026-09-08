import { LangchainGenerateRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class GenerateLangchainDto extends createZodDto(
  LangchainGenerateRequestSchema,
) {}
