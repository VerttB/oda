import {
  LangchainHealthResponseSchema,
  LangchainResponseSchema,
} from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class LangchainResponseDto extends createZodDto(
  LangchainResponseSchema,
) {}

export class LangchainHealthResponseDto extends createZodDto(
  LangchainHealthResponseSchema,
) {}
