import { EstadoResponseSchema } from '@oda/shared-types';
import { createZodDto } from 'nestjs-zod';

export class EstadoResponseDto extends createZodDto(EstadoResponseSchema) {}
