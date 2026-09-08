import { LangchainSummarizeRequestSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class SummarizeLangchainDto extends createZodDto(
  LangchainSummarizeRequestSchema,
) {}
