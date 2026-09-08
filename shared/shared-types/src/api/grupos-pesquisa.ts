import { z } from 'zod';
import { PaginationQuerySchema } from './pagination';

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

export const FindAllGruposPesquisaQuerySchema = PaginationQuerySchema.extend({
  situacao: SituacaoGrupoPesquisaSchema.optional(),
  nome: z.string().optional(),
  anoFormacao: z.coerce.number().int().optional(),
  instituicaoId: z.string().uuid().optional(),
  areaConhecimentoId: z.string().uuid().optional(),
  estadoId: z.string().uuid().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
});

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
export type FindAllGruposPesquisaQuery = z.infer<
  typeof FindAllGruposPesquisaQuerySchema
>;
