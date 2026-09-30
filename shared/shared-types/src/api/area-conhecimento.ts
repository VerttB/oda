import { z } from 'zod';
import { PaginationQuerySchema, SortOrderSchema } from './pagination';
import { createPaginatedResponseSchema } from './pagination';

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
  ordenarPor: z.enum(['nome', 'tipo']).optional(),
  ordem: SortOrderSchema.optional(),
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

// ==========================================
// RESPONSE SCHEMAS
// ==========================================

export const AreaConhecimentoResponseSchema = z.object({
  id: z.string(), nome: z.string(), nomeNormalizado: z.string(),
  tipo: TipoAreaConhecimentoSchema.nullable().optional(),
  areaPaiId: z.string().nullable(),
});

export const AreaConhecimentoDetalheResponseSchema = AreaConhecimentoResponseSchema.extend({
  areaPai: AreaConhecimentoResponseSchema.nullable().optional(),
  subareas: z.array(AreaConhecimentoResponseSchema).optional(),
});

export const PaginatedAreaConhecimentoResponseSchema =
  createPaginatedResponseSchema(AreaConhecimentoResponseSchema);

export const MetricasAreasConhecimentoResponseSchema = z.object({
  total: z.number().int().min(0),
  raizes: z.number().int().min(0),
  comAreaPai: z.number().int().min(0),
  gruposComAreaPrincipal: z.number().int().min(0),
  mapeadasOpenAlex: z.number().int().min(0),
  mapeadasOpenAlexPercentual: z.number(),
  cnpqPorTipo: z.array(z.object({ tipo: z.string(), total: z.number().int().min(0) })),
  openAlexPorTipo: z.array(z.object({ tipo: z.string(), total: z.number().int().min(0) })),
  gruposAreasPorRelacao: z.array(z.object({ relacao: z.string(), total: z.number().int().min(0) })),
  gruposAreasPorMetodo: z.array(z.object({ metodoInferencia: z.string(), total: z.number().int().min(0) })),
  mapeamentosPorStatus: z.array(z.object({ status: z.string(), total: z.number().int().min(0) })),
});

// Export response types
export type AreaConhecimentoResponse = z.infer<typeof AreaConhecimentoResponseSchema>;
export type AreaConhecimentoDetalheResponse = z.infer<typeof AreaConhecimentoDetalheResponseSchema>;
export type PaginatedAreaConhecimentoResponse = z.infer<typeof PaginatedAreaConhecimentoResponseSchema>;
export type MetricasAreasConhecimentoResponse = z.infer<typeof MetricasAreasConhecimentoResponseSchema>;
