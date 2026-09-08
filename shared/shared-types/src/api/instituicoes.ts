import { z } from 'zod';
import { PaginationQuerySchema } from './pagination';

export const CreateInstituicaoRequestSchema = z.object({
  nome: z.string().min(2).max(255),
  sigla: z.string().min(2).max(30),
  estadoId: z.string().uuid().optional(),
});

export const UpdateInstituicaoRequestSchema =
  CreateInstituicaoRequestSchema.partial();

export const FindAllInstituicaoQuerySchema = PaginationQuerySchema.extend({
  nome: z.string().optional(),
  estadoId: z.string().uuid().optional(),
  uf: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
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
