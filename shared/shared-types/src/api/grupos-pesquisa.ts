import { z } from 'zod';

export const SituacaoGrupoPesquisaSchema = z.enum([
  'ATIVO',
  'INATIVO',
  'EM_ANALISE',
]);

export const TipoRelacaoGrupoInstituicaoSchema = z.enum(['SEDE', 'PARCEIRA']);

export const GrupoPesquisaInstituicaoRequestSchema = z.object({
  instituicaoId: z.string().uuid(),
  tipoRelacao: TipoRelacaoGrupoInstituicaoSchema.optional(),
  unidade: z.string().optional(),
  unidadeUf: z.string().optional(),
});

export const CreateGruposPesquisaRequestSchema = z.object({
  dgpId: z.string().optional(),
  nome: z.string(),
  anoFormacao: z.coerce.number().int().optional(),
  areaPredominante: z.string(),
  repercussao: z.string().optional(),
  situacao: SituacaoGrupoPesquisaSchema.optional(),
  instituicoes: z.array(GrupoPesquisaInstituicaoRequestSchema).nonempty(),
});

export const UpdateGruposPesquisaRequestSchema =
  CreateGruposPesquisaRequestSchema.partial();

export type SituacaoGrupoPesquisa = z.infer<typeof SituacaoGrupoPesquisaSchema>;
export type TipoRelacaoGrupoInstituicaoRequest = z.infer<
  typeof TipoRelacaoGrupoInstituicaoSchema
>;
export type GrupoPesquisaInstituicaoRequest = z.infer<
  typeof GrupoPesquisaInstituicaoRequestSchema
>;
export type CreateGruposPesquisaRequest = z.infer<
  typeof CreateGruposPesquisaRequestSchema
>;
export type UpdateGruposPesquisaRequest = z.infer<
  typeof UpdateGruposPesquisaRequestSchema
>;
