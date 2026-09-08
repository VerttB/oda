import { z } from 'zod';
import { PaginationQuerySchema } from './pagination';

export const TipoPesquisadorSchema = z.enum([
  'TECNICO',
  'ESTUDANTE',
  'PESQUISADOR',
  'COLABORADOR_ESTRANGEIRO',
]);

export const FormacaoAcademicaSchema = z.enum([
  'GRADUACAO',
  'ESPECIALIZACAO',
  'MESTRADO',
  'DOUTORADO',
  'OUTRO',
]);

export const CreatePesquisadorRequestSchema = z.object({
  lattesId: z.string().max(100).optional(),
  nome: z.string().min(2).max(255),
  tipo: TipoPesquisadorSchema.optional(),
  formacaoAcademica: FormacaoAcademicaSchema.optional(),
  imageUrl: z.string().optional(),
});

export const UpdatePesquisadorRequestSchema =
  CreatePesquisadorRequestSchema.partial();

const booleanQuerySchema = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const FindAllPesquisadoresQuerySchema = PaginationQuerySchema.extend({
  nome: z.string().optional(),
  formacaoAcademica: FormacaoAcademicaSchema.optional(),
  tipo: TipoPesquisadorSchema.optional(),
  lattesId: z.string().optional(),
  orcidId: z.string().optional(),
  grupoPesquisaId: z.string().uuid().optional(),
  eLider: booleanQuerySchema.optional(),
});

export const FindPesquisadoresByGrupoQuerySchema =
  FindAllPesquisadoresQuerySchema.omit({ grupoPesquisaId: true });

export type TipoPesquisadorRequest = z.infer<typeof TipoPesquisadorSchema>;
export type FormacaoAcademicaRequest = z.infer<typeof FormacaoAcademicaSchema>;
export type CreatePesquisadorRequest = z.infer<
  typeof CreatePesquisadorRequestSchema
>;
export type UpdatePesquisadorRequest = z.infer<
  typeof UpdatePesquisadorRequestSchema
>;
export type FindAllPesquisadoresQuery = z.infer<
  typeof FindAllPesquisadoresQuerySchema
>;
export type FindPesquisadoresByGrupoQuery = z.infer<
  typeof FindPesquisadoresByGrupoQuerySchema
>;
