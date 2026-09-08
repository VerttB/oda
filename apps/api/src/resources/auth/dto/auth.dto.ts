import { LoginRequestSchema, LoginResponseSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class LoginRequestDto extends createZodDto(LoginRequestSchema) {}

export class LoginResponseDto extends createZodDto(LoginResponseSchema) {}
