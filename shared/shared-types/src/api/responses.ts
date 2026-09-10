import { z } from 'zod';
import { SituacaoGrupoPesquisaSchema, TipoRelacaoGrupoInstituicaoSchema } from './grupos-pesquisa';
import { FormacaoAcademicaSchema, TipoPesquisadorSchema } from './pesquisadores';
import { createPaginatedResponseSchema } from './pagination';
import { QualisSchema, TipoProducaoSchema } from './producoes';
import { TipoAreaConhecimentoSchema } from './area-conhecimento';

export const AreaConhecimentoResponseSchema = z.object({
  id: z.string(), nome: z.string(), nomeNormalizado: z.string(),
  tipo: TipoAreaConhecimentoSchema.nullable().optional(),
  areaPaiId: z.string().nullable(),
});

export const AreaConhecimentoDetalheResponseSchema = AreaConhecimentoResponseSchema.extend({
  areaPai: AreaConhecimentoResponseSchema.nullable().optional(),
  subareas: z.array(AreaConhecimentoResponseSchema).optional(),
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
  tipo: TipoProducaoSchema,
  doi: z.string().nullable(), url: z.string().nullable(), veiculo: z.string().nullable(),
  issn: z.string().nullable(), qualis: QualisSchema.nullable(),
  resumo: z.string().nullable(), ordemAutoria: z.number().nullable(),
});

export const GrupoPesquisaInstituicaoResponseSchema = z.object({
  id: z.string(), nome: z.string(), sigla: z.string(),
  imageUrl: z.string().nullable(),
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

const RawVinculoResponseSchema = z.record(z.string(), z.unknown());

export const LinhaPesquisaResponseSchema = z.object({
  id: z.string(),
  dgpId: z.string().nullable(),
  titulo: z.string(),
  objetivo: z.string().nullable(),
  grupoId: z.string(),
  membros: z.array(RawVinculoResponseSchema).optional(),
  palavrasChave: z.array(RawVinculoResponseSchema).optional(),
  setoresAplicacao: z.array(RawVinculoResponseSchema).optional(),
}).passthrough();

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

export const EstadoResponseSchema = z.object({
  id: z.string(),
  sigla: z.string(),
  nome: z.string(),
  regiao: z.string(),
});

export const PaginatedGruposPesquisaResponseSchema =
  createPaginatedResponseSchema(GruposPesquisaResponseSchema);

export const PaginatedPesquisadorResumoResponseSchema =
  createPaginatedResponseSchema(PesquisadorResumoResponseSchema);

export const PaginatedPesquisadorResponseSchema =
  createPaginatedResponseSchema(PesquisadorResponseSchema);

export const PaginatedLinhaPesquisaResponseSchema =
  createPaginatedResponseSchema(LinhaPesquisaResponseSchema);

export const PaginatedProducaoResponseSchema =
  createPaginatedResponseSchema(ProducaoResponseSchema);

export const PaginatedAreaConhecimentoResponseSchema =
  createPaginatedResponseSchema(AreaConhecimentoResponseSchema);

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

export const GrupoPesquisaMetricasResponseSchema = z.object({
  grupo: GruposPesquisaResponseSchema,
  totais: z.object({
    pesquisadores: z.number().int().min(0),
    pesquisadoresComLattes: z.number().int().min(0),
    linhasPesquisa: z.number().int().min(0),
    areasConhecimento: z.number().int().min(0),
    areasConhecimentoPrincipais: z.number().int().min(0),
    areasConhecimentoAdicionais: z.number().int().min(0),
    producoes: z.number().int().min(0),
    instituicoesParceiras: z.number().int().min(0),
  }),
  cobertura: z.object({
    pesquisadoresComLattesPercentual: z.number(),
    producoesComDoi: z.number().int().min(0),
    producoesComDoiPercentual: z.number(),
    producoesComQualis: z.number().int().min(0),
    producoesComQualisPercentual: z.number(),
  }),
  pesquisadoresPorTipo: z.array(z.object({
    tipo: z.string(),
    total: z.number().int().min(0),
  })),
  pesquisadoresPorFormacao: z.array(z.object({
    formacao: z.string(),
    total: z.number().int().min(0),
  })),
  producoesPorAno: z.array(TotalPorAnoResponseSchema),
  producoesPorTipo: z.array(TotalPorTipoProducaoResponseSchema),
  producoesPorQualis: z.array(TotalPorQualisResponseSchema),
});

export const PesquisadorMetricasResponseSchema = z.object({
  pesquisador: PesquisadorResumoResponseSchema,
  totais: z.object({
    grupos: z.number().int().min(0),
    gruposComoLider: z.number().int().min(0),
    linhasPesquisa: z.number().int().min(0),
    areasConhecimento: z.number().int().min(0),
    producoes: z.number().int().min(0),
  }),
  cobertura: z.object({
    producoesComDoi: z.number().int().min(0),
    producoesComDoiPercentual: z.number(),
    producoesComQualis: z.number().int().min(0),
    producoesComQualisPercentual: z.number(),
  }),
  producoesPorTipo: z.array(TotalPorTipoProducaoResponseSchema),
  producoesPorAno: z.array(TotalPorAnoResponseSchema),
  producoesPorQualis: z.array(TotalPorQualisResponseSchema),
});

export const MetricasGruposPesquisaResponseSchema = z.object({
  total: z.number().int().min(0),
  porUf: z.array(z.object({
    uf: z.string(),
    total: z.number().int().min(0),
  })),
  porInstituicao: z.array(z.object({
    instituicaoId: z.string(),
    nome: z.string().nullable(),
    sigla: z.string().nullable(),
    uf: z.string().nullable(),
    total: z.number().int().min(0),
    sede: z.number().int().min(0),
    parceira: z.number().int().min(0),
  })),
});

export const MetricasPesquisadoresResponseSchema = z.object({
  totalPesquisadores: z.number().int().min(0),
  totalComOrcid: z.number().int().min(0),
  porFormacao: z.array(z.object({ formacao: z.string(), total: z.number().int().min(0) })),
  porTipo: z.array(z.object({ tipo: z.string(), total: z.number().int().min(0) })),
});

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

export const MetricasFilasExtracaoResponseSchema = z.object({
  gruposPesquisa: z.object({
    comErro: z.number().int().min(0),
    porStatus: z.array(z.object({ status: z.string(), total: z.number().int().min(0) })),
  }),
  pesquisadores: z.object({
    comErro: z.number().int().min(0),
    porStatus: z.array(z.object({ status: z.string(), total: z.number().int().min(0) })),
  }),
});

export const MetricasGeraisResponseSchema = z.object({
  gruposDePesquisa: MetricasGruposPesquisaResponseSchema,
  pesquisadores: MetricasPesquisadoresResponseSchema,
  areasConhecimento: MetricasAreasConhecimentoResponseSchema,
  producoes: MetricasProducoesResponseSchema,
  instituicoes: MetricasInstituicoesResponseSchema,
  filasExtracao: MetricasFilasExtracaoResponseSchema,
});

export type GruposPesquisaResponse = z.infer<typeof GruposPesquisaResponseSchema>;
export type PesquisadorResponse = z.infer<typeof PesquisadorResponseSchema>;
export type GrupoPesquisaInstituicaoResponse = z.infer<typeof GrupoPesquisaInstituicaoResponseSchema>;
export type ProducaoPesquisadorResponse = z.infer<typeof ProducaoPesquisadorResponseSchema>;
export type LinhaPesquisaResponse = z.infer<typeof LinhaPesquisaResponseSchema>;
export type ProducaoResponse = z.infer<typeof ProducaoResponseSchema>;
export type EstadoResponse = z.infer<typeof EstadoResponseSchema>;
export type PaginatedGruposPesquisaResponse = z.infer<typeof PaginatedGruposPesquisaResponseSchema>;
export type PaginatedPesquisadorResumoResponse = z.infer<typeof PaginatedPesquisadorResumoResponseSchema>;
export type PaginatedPesquisadorResponse = z.infer<typeof PaginatedPesquisadorResponseSchema>;
export type PaginatedLinhaPesquisaResponse = z.infer<typeof PaginatedLinhaPesquisaResponseSchema>;
export type PaginatedProducaoResponse = z.infer<typeof PaginatedProducaoResponseSchema>;
export type PaginatedAreaConhecimentoResponse = z.infer<typeof PaginatedAreaConhecimentoResponseSchema>;
export type GrupoPesquisaMetricasResponse = z.infer<typeof GrupoPesquisaMetricasResponseSchema>;
export type PesquisadorMetricasResponse = z.infer<typeof PesquisadorMetricasResponseSchema>;

export const InstituicaoResponseSchema = z.object({
  id: z.string(), nome: z.string(), sigla: z.string(),
  imageUrl: z.string().nullable(),
  estado: GrupoPesquisaInstituicaoResponseSchema.shape.estado,
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
export type InstituicaoResponse = z.infer<typeof InstituicaoResponseSchema>;
export type InstituicaoResumoResponse = z.infer<typeof InstituicaoResumoResponseSchema>;
export type PaginatedInstituicaoResponse = z.infer<typeof PaginatedInstituicaoResponseSchema>;
