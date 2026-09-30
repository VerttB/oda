import { z } from 'zod';
import { PaginationQuerySchema, SortOrderSchema } from './pagination';
import { createPaginatedResponseSchema } from './pagination';

export const TipoProducaoSchema = z.enum(['ARTIGO', 'LIVROCAPITULO', 'OUTRA']);
export const QualisSchema = z.enum(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C']);

export const ProducaoAutorRequestSchema = z.object({
  pesquisadorId: z.string().uuid(),
  ordemAutoria: z.coerce.number().int().optional(),
});

export const CreateProducaoRequestSchema = z.object({
  titulo: z.string(),
  ano: z.coerce.number().int().optional(),
  tipo: TipoProducaoSchema.optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  veiculo: z.string().optional(),
  resumo: z.string().optional(),
  autores: z.array(ProducaoAutorRequestSchema).optional(),
  palavraChaveIds: z.array(z.string().uuid()).optional(),
});

export const UpdateProducaoRequestSchema =
  CreateProducaoRequestSchema.partial();

export const FindAllProducoesQuerySchema = PaginationQuerySchema.extend({
  titulo: z.string().optional(),
  ano: z.coerce.number().int().optional(),
  tipo: TipoProducaoSchema.optional(),
  qualis: QualisSchema.optional(),
  issn: z.string().trim().toUpperCase().regex(/^\d{4}-?\d{3}[\dX]$/).optional(),
  pesquisadorId: z.string().uuid().optional(),
  grupoId: z.string().uuid().optional(),
  ordenarPor: z.enum(['titulo', 'ano', 'tipo', 'qualis']).optional(),
  ordem: SortOrderSchema.optional(),
});

export const FindProducoesByPesquisadorQuerySchema =
  FindAllProducoesQuerySchema.omit({ pesquisadorId: true });

export type CreateProducaoRequest = z.infer<typeof CreateProducaoRequestSchema>;
export type UpdateProducaoRequest = z.infer<typeof UpdateProducaoRequestSchema>;
export type FindAllProducoesQuery = z.infer<typeof FindAllProducoesQuerySchema>;
export type FindProducoesByPesquisadorQuery = z.infer<
  typeof FindProducoesByPesquisadorQuerySchema
>;

// ==========================================
// RESPONSE SCHEMAS
// ==========================================

const RawVinculoResponseSchema = z.record(z.string(), z.unknown());

export const ProducaoResponseSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  ano: z.number().nullable(),
  tipo: TipoProducaoSchema,
  doi: z.string().nullable(),
  url: z.string().nullable(),
  veiculo: z.string().nullable(),
  issn: z.string().nullable(),
  qualis: QualisSchema.nullable(),
  resumo: z.string().nullable(),
  autores: z.array(RawVinculoResponseSchema).optional(),
  palavrasChave: z.array(RawVinculoResponseSchema).optional(),
}).passthrough();

export const ProducaoPesquisadorResponseSchema = z.object({
  id: z.string(), titulo: z.string(), ano: z.number().nullable(),
  tipo: TipoProducaoSchema,
  doi: z.string().nullable(), url: z.string().nullable(), veiculo: z.string().nullable(),
  issn: z.string().nullable(), qualis: QualisSchema.nullable(),
  resumo: z.string().nullable(), ordemAutoria: z.number().nullable(),
});

export const PaginatedProducaoResponseSchema =
  createPaginatedResponseSchema(ProducaoResponseSchema);

const TotalPorAnoResponseSchema = z.object({
  ano: z.number().nullable(),
  total: z.number().int().min(0),
});

const TotalPorTipoProducaoResponseSchema = z.object({
  tipo: z.string(),
  total: z.number().int().min(0),
});

const TotalPorQualisResponseSchema = z.object({
  qualis: z.string().nullable(),
  total: z.number().int().min(0),
});

export const MetricasProducoesResponseSchema = z.object({
  total: z.number().int().min(0),
  valoresNulos: z.object({
    doi: z.number().int().min(0),
    resumo: z.number().int().min(0),
    issn: z.number().int().min(0),
    qualis: z.number().int().min(0),
    url: z.number().int().min(0),
  }),
  cobertura: z.object({
    doiPercentual: z.number(),
    resumoPercentual: z.number(),
    issnPercentual: z.number(),
    qualisPercentual: z.number(),
    urlPercentual: z.number(),
  }),
  totalPorQualis: z.array(TotalPorQualisResponseSchema),
  totalPorTipo: z.array(TotalPorTipoProducaoResponseSchema),
  totalPorAno: z.array(TotalPorAnoResponseSchema),
});

// Export response types
export type ProducaoResponse = z.infer<typeof ProducaoResponseSchema>;
export type ProducaoPesquisadorResponse = z.infer<typeof ProducaoPesquisadorResponseSchema>;
export type PaginatedProducaoResponse = z.infer<typeof PaginatedProducaoResponseSchema>;
export type MetricasProducoesResponse = z.infer<typeof MetricasProducoesResponseSchema>;
