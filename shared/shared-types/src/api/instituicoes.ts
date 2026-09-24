import { z } from 'zod';
import { PaginationQuerySchema, SortOrderSchema } from './pagination';

export const CreateInstituicaoRequestSchema = z.object({
  nome: z.string().min(2).max(255),
  sigla: z.string().min(2).max(30),
  imageUrl: z.string().optional(),
  estadoId: z.string().uuid().optional(),
});

export const UpdateInstituicaoRequestSchema =
  CreateInstituicaoRequestSchema.partial();

export const FindAllInstituicaoQuerySchema = PaginationQuerySchema.extend({
  nome: z.string().optional(),
  estadoId: z.string().uuid().optional(),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  ordenarPor: z.enum(['nome', 'sigla']).optional(),
  ordem: SortOrderSchema.optional(),
});

export type CreateInstituicaoRequest = z.infer<
  typeof CreateInstituicaoRequestSchema
>;
export type UpdateInstituicaoRequest = z.infer<
  typeof UpdateInstituicaoRequestSchema
>;
export type FindAllInstituicaoQuery = z.infer<
  typeof FindAllInstituicaoQuerySchema
>;
