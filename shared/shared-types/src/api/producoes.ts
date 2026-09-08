import { z } from 'zod';
import { PaginationQuerySchema } from './pagination';

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
});

export const FindProducoesByPesquisadorQuerySchema =
  FindAllProducoesQuerySchema.omit({ pesquisadorId: true });

export type CreateProducaoRequest = z.infer<typeof CreateProducaoRequestSchema>;
export type UpdateProducaoRequest = z.infer<typeof UpdateProducaoRequestSchema>;
export type FindAllProducoesQuery = z.infer<typeof FindAllProducoesQuerySchema>;
export type FindProducoesByPesquisadorQuery = z.infer<
  typeof FindProducoesByPesquisadorQuerySchema
>;
