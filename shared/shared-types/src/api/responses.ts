import { z } from 'zod';
import { SituacaoGrupoPesquisaSchema, TipoRelacaoGrupoInstituicaoSchema } from './grupos-pesquisa';
import { FormacaoAcademicaSchema, TipoPesquisadorSchema } from './pesquisadores';

export const AreaConhecimentoResponseSchema = z.object({
  id: z.string(), nome: z.string(), nomeNormalizado: z.string(),
  tipo: z.enum(['GRANDE_AREA', 'AREA', 'SUBAREA', 'TOPICO']).nullable().optional(),
  areaPaiId: z.string().nullable(),
});

export const GrupoPesquisaAreaConhecimentoResponseSchema = AreaConhecimentoResponseSchema.extend({
  relacao: z.enum(['PRINCIPAL', 'ADICIONAL']),
  metodoInferencia: z.enum(['DGP', 'IA', 'MANUAL']),
  confianca: z.number().nullable(),
  justificativa: z.string().nullable(),
  metadata: z.unknown().nullable().optional(),
});

export const GrupoPesquisaResumoResponseSchema = z.object({
  id: z.string(), dgpId: z.string().nullable(), nome: z.string(),
  anoFormacao: z.number().nullable(), areaPredominante: z.string(),
  repercussao: z.string().nullable(), situacao: SituacaoGrupoPesquisaSchema,
  email: z.string().nullable(), telefone: z.string().nullable(), website: z.string().nullable(),
  logradouro: z.string().nullable(), numero: z.string().nullable(), complemento: z.string().nullable(),
  bairro: z.string().nullable(), cidade: z.string().nullable(), uf: z.string().nullable(), cep: z.string().nullable(),
  latitude: z.number().nullable(), longitude: z.number().nullable(),
});

export const PesquisadorResumoResponseSchema = z.object({
  id: z.string(), lattesId: z.string().nullable(), nome: z.string(),
  tipo: TipoPesquisadorSchema.nullable(), formacaoAcademica: FormacaoAcademicaSchema.nullable(),
  openAlexId: z.string().nullable(), orcidId: z.string().nullable(), imageUrl: z.string().nullable(),
  indexH: z.number().nullable(), indexI10: z.number().nullable(),
});

export const ProducaoPesquisadorResponseSchema = z.object({
  id: z.string(), titulo: z.string(), ano: z.number().nullable(),
  tipo: z.enum(['ARTIGO', 'LIVROCAPITULO', 'OUTRA']),
  doi: z.string().nullable(), url: z.string().nullable(), veiculo: z.string().nullable(),
  issn: z.string().nullable(), qualis: z.enum(['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C']).nullable(),
  resumo: z.string().nullable(), ordemAutoria: z.number().nullable(),
});

export const GrupoPesquisaInstituicaoResponseSchema = z.object({
  id: z.string(), nome: z.string(), sigla: z.string(),
  tipoRelacao: TipoRelacaoGrupoInstituicaoSchema,
  unidade: z.object({ nome: z.string().nullable(), uf: z.string().nullable() }).nullable(),
  estado: z.object({ id: z.string(), sigla: z.string(), nome: z.string(), regiao: z.string() }).nullable(),
});

const vinculoGrupo = { eLider: z.boolean(), dataEntrada: z.string().datetime().nullable() };

export const GruposPesquisaResponseSchema = GrupoPesquisaResumoResponseSchema.extend({
  instituicoes: z.array(GrupoPesquisaInstituicaoResponseSchema).optional(),
  areaConhecimento: AreaConhecimentoResponseSchema.nullable().optional(),
  areasConhecimento: z.array(GrupoPesquisaAreaConhecimentoResponseSchema).optional(),
  linhasPesquisa: z.array(z.object({
    id: z.string(), dgpId: z.string().nullable(), titulo: z.string(), objetivo: z.string().nullable(),
  })).optional(),
  membros: z.array(PesquisadorResumoResponseSchema.extend(vinculoGrupo)).optional(),
});

export const PesquisadorResponseSchema = PesquisadorResumoResponseSchema.extend({
  producoes: z.array(ProducaoPesquisadorResponseSchema).optional(),
  membrosGrupo: z.array(GrupoPesquisaResumoResponseSchema.extend(vinculoGrupo)).optional(),
  areasConhecimento: z.array(AreaConhecimentoResponseSchema).optional(),
});

export type GruposPesquisaResponse = z.infer<typeof GruposPesquisaResponseSchema>;
export type PesquisadorResponse = z.infer<typeof PesquisadorResponseSchema>;
export type GrupoPesquisaInstituicaoResponse = z.infer<typeof GrupoPesquisaInstituicaoResponseSchema>;
export type ProducaoPesquisadorResponse = z.infer<typeof ProducaoPesquisadorResponseSchema>;

export const InstituicaoResponseSchema = z.object({
  id: z.string(), nome: z.string(), sigla: z.string(),
  estado: GrupoPesquisaInstituicaoResponseSchema.shape.estado,
  gruposPesquisa: z.array(GrupoPesquisaResumoResponseSchema.pick({
    id: true, dgpId: true, nome: true, situacao: true, uf: true, cidade: true,
  }).extend({
    tipoRelacao: TipoRelacaoGrupoInstituicaoSchema,
    unidade: GrupoPesquisaInstituicaoResponseSchema.shape.unidade,
  })),
  totalGruposPesquisa: z.number().int().nonnegative(),
});
export type InstituicaoResponse = z.infer<typeof InstituicaoResponseSchema>;
