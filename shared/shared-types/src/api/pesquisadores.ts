import { z } from 'zod';

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

export type TipoPesquisadorRequest = z.infer<typeof TipoPesquisadorSchema>;
export type FormacaoAcademicaRequest = z.infer<typeof FormacaoAcademicaSchema>;
export type CreatePesquisadorRequest = z.infer<
  typeof CreatePesquisadorRequestSchema
>;
export type UpdatePesquisadorRequest = z.infer<
  typeof UpdatePesquisadorRequestSchema
>;
