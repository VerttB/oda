import { z } from "zod";
export const ProcessamentoSchema = z.enum([
  "SCRAPER_DGP",
  "SCRAPER_LATTES",
  "DESCOBERTA",
  "ETL_GRUPOS",
  "ETL_PESQUISADORES",
]);
export const PipelineQuerySchema = z
  .object({
    dataInicio: z.iso
      .date()
      .default(() =>
        new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      ),
    dataFim: z.iso.date().default(() => new Date().toISOString().slice(0, 10)),
    processamento: ProcessamentoSchema.optional(),
    escopo: z.enum(["default", "simcc", "nao_informado"]).optional(),
    status: z.enum(["SUCESSO", "ERRO"]).optional(),
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine(
    (v) =>
      v.dataInicio <= v.dataFim &&
      Date.parse(v.dataFim) - Date.parse(v.dataInicio) <= 366 * 86400000,
    {
      message: "Informe um intervalo válido de até 366 dias.",
      path: ["dataFim"],
    },
  );
export type PipelineQuery = z.infer<typeof PipelineQuerySchema>;
export const ConsistenciaQuerySchema = z
  .object({
    dataInicio: PipelineQuerySchema.shape.dataInicio,
    dataFim: PipelineQuerySchema.shape.dataFim,
    pagina: PipelineQuerySchema.shape.pagina,
    limite: PipelineQuerySchema.shape.limite,
  })
  .refine(
    (v) =>
      v.dataInicio <= v.dataFim &&
      Date.parse(v.dataFim) - Date.parse(v.dataInicio) <= 366 * 86400000,
    { message: "Intervalo inválido; máximo de 366 dias.", path: ["dataFim"] },
  );
export const PipelineSerieSchema = z.object({
  dia: z.string(),
  processamento: ProcessamentoSchema,
  escopo: z.string(),
  sucessos: z.number(),
  falhas: z.number(),
  processados: z.number(),
  taxaSucesso: z.number().nullable(),
  duracaoMediaMs: z.number().nullable(),
  itensComDuracao: z.number(),
  tentativasAdicionais: z.number(),
  itensComTentativas: z.number(),
});
export const PipelineMetricasSchema = z.object({
  serie: z.array(PipelineSerieSchema),
  errosPorTipoRetidos: z.array(
    z.object({ tipoErro: z.string(), total: z.number().int().nonnegative() }),
  ),
  resumo: z.object({
    processados: z.number(),
    sucessos: z.number(),
    falhas: z.number(),
    taxaSucesso: z.number().nullable(),
  }),
});
export const PipelineExecucaoSchema = z.object({
  id: z.string(),
  modulo: z.string(),
  status: z.string(),
  escopo: z.string().nullable(),
  inicio: z.string(),
  fim: z.string().nullable(),
  duracaoMs: z.number().nullable(),
  processados: z.number(),
  sucessos: z.number(),
  falhas: z.number(),
});
export const PipelineItemSchema = z.object({
  id: z.string(),
  pipelineLogId: z.string(),
  entidadeId: z.string().nullable(),
  etapa: z.string().nullable(),
  status: z.string(),
  tipoErro: z.string().nullable(),
  mensagemErro: z.string().nullable(),
  tempoMs: z.number().nullable(),
  encerradoEm: z.string(),
  tentativas: z.number().nullable(),
});
export const PipelineExecucoesSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  limite: z.number(),
  dados: z.array(PipelineExecucaoSchema),
});
export const PipelineItensSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  limite: z.number(),
  dados: z.array(PipelineItemSchema),
});
export const ConsistenciaResultadoSchema = z.object({
  metricas: z.array(
    z.object({
      metrica: z.string(),
      antes: z.number(),
      depois: z.number(),
      diferenca: z.number(),
      variacaoPercentual: z.number().nullable(),
      estado: z.string(),
    }),
  ),
  alertas: z.array(
    z.object({
      dgpId: z.string().nullable(),
      regra: z.string(),
      mensagem: z.string(),
    }),
  ),
  limites: z.object({
    reducaoPercentual: z.number(),
    aumentoPercentual: z.number(),
  }),
});
export const ConsistenciaRelatorioSchema = z.object({
  id: z.string(),
  pipelineLogId: z.string().nullable(),
  estado: z.string(),
  escopo: z.literal("simcc"),
  iniciadoEm: z.string(),
  finalizadoEm: z.string().nullable(),
  resultado: ConsistenciaResultadoSchema.nullable(),
  erro: z.string().nullable(),
});
export const ConsistenciaHistoricoSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  limite: z.number(),
  dados: z.array(ConsistenciaRelatorioSchema),
});
export const LimparFilaRequestSchema = z.object({
  estado: z.enum(["completed", "failed"]),
  maisAntigoQueHoras: z.coerce.number().int().min(1).max(8760).default(168),
  limite: z.coerce.number().int().min(1).max(500).default(100),
  simular: z.boolean().default(true),
});
export type LimparFilaRequest = z.infer<typeof LimparFilaRequestSchema>;
export const LimparFilaResponseSchema = z.object({
  fila: z.string(),
  simulacao: z.boolean(),
  examinados: z.number(),
  elegiveis: z.number(),
  removidos: z.number(),
  ignorados: z.number(),
  ids: z.array(z.string()),
});
export type PipelineMetricasResponse = z.infer<typeof PipelineMetricasSchema>;
export type PipelineExecucoesResponse = z.infer<typeof PipelineExecucoesSchema>;
export type PipelineItensResponse = z.infer<typeof PipelineItensSchema>;
export type ConsistenciaRelatorioResponse = z.infer<
  typeof ConsistenciaRelatorioSchema
>;
