import { z } from 'zod';
import { PaginationQuerySchema } from './pagination';

export const TipoAreaConhecimentoSchema = z.enum([
  'GRANDE_AREA',
  'AREA',
  'SUBAREA',
  'TOPICO',
]);

export const CreateAreaConhecimentoRequestSchema = z.object({
  nome: z.string().min(1),
  tipo: TipoAreaConhecimentoSchema.optional(),
  areaPaiId: z.string().uuid().nullable().optional(),
});

export const UpdateAreaConhecimentoRequestSchema =
  CreateAreaConhecimentoRequestSchema.partial();

export const FindAllAreaConhecimentoQuerySchema = PaginationQuerySchema.extend({
  nome: z.string().optional(),
  tipo: TipoAreaConhecimentoSchema.optional(),
  areaPaiId: z.string().uuid().optional(),
});

export type CreateAreaConhecimentoRequest = z.infer<
  typeof CreateAreaConhecimentoRequestSchema
>;
export type UpdateAreaConhecimentoRequest = z.infer<
  typeof UpdateAreaConhecimentoRequestSchema
>;
export type FindAllAreaConhecimentoQuery = z.infer<
  typeof FindAllAreaConhecimentoQuerySchema
>;
