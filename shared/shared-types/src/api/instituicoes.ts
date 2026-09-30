import { z } from 'zod';
import { PaginationQuerySchema, SortOrderSchema } from './pagination';
import { createPaginatedResponseSchema } from './pagination';
import { GrupoPesquisaResumoResponseSchema, TipoRelacaoGrupoInstituicaoSchema, GrupoPesquisaInstituicaoResponseSchema, EstadoResponseSchema } from './grupos-pesquisa';

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

// ==========================================
// RESPONSE SCHEMAS
// ==========================================

export const InstituicaoResponseSchema = z.object({
  id: z.string(), nome: z.string(), sigla: z.string(),
  imageUrl: z.string().nullable(),
  estado: EstadoResponseSchema.nullable(),
  gruposPesquisa: z.array(GrupoPesquisaResumoResponseSchema.pick({
    id: true, dgpId: true, nome: true, situacao: true, uf: true, cidade: true,
  }).extend({
    tipoRelacao: TipoRelacaoGrupoInstituicaoSchema,
    unidade: GrupoPesquisaInstituicaoResponseSchema.shape.unidade,
  })),
  totalGruposPesquisa: z.number().int().nonnegative(),
});

export const InstituicaoResumoResponseSchema = z.object({
  id: z.string(),
  nome: z.string(),
  sigla: z.string(),
  imageUrl: z.string().nullable(),
  estadoId: z.string().nullable(),
});

export const PaginatedInstituicaoResponseSchema =
  createPaginatedResponseSchema(InstituicaoResponseSchema);

export const MetricasInstituicoesResponseSchema = z.object({
  total: z.number().int().min(0),
  semUf: z.number().int().min(0),
  porUf: z.array(z.object({
    uf: z.string(),
    estado: z.string().nullable(),
    regiao: z.string().nullable(),
    total: z.number().int().min(0),
  })),
  vinculosComGrupos: z.object({
    sede: z.number().int().min(0),
    parceira: z.number().int().min(0),
  }),
  instituicoesComGrupos: z.object({
    sede: z.number().int().min(0),
    parceira: z.number().int().min(0),
  }),
});

// Export response types
export type InstituicaoResponse = z.infer<typeof InstituicaoResponseSchema>;
export type InstituicaoResumoResponse = z.infer<typeof InstituicaoResumoResponseSchema>;
export type PaginatedInstituicaoResponse = z.infer<typeof PaginatedInstituicaoResponseSchema>;
export type MetricasInstituicoesResponse = z.infer<typeof MetricasInstituicoesResponseSchema>;
