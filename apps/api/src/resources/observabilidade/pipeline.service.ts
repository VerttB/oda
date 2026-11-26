import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@oda/database";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PipelineQuery,
  PipelineSerieSchema,
  PipelineExecucoesSchema,
  PipelineItensSchema,
  getPagination,
} from "@oda/shared-types";
import { itemFilters } from "./pipeline-query";
@Injectable()
export class PipelineService {
  constructor(private readonly db: PrismaService) {}
  async metrics(q: PipelineQuery) {
    const rows = await this.db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT dia::text,processamento,escopo,sucessos::int,falhas::int,
        (sucessos+falhas)::int AS processados,
        CASE WHEN sucessos+falhas>0 THEN 100.0*sucessos/(sucessos+falhas) END::float8 AS "taxaSucesso",
        CASE WHEN itens_com_duracao>0 THEN duracao_total_ms::float8/itens_com_duracao END AS "duracaoMediaMs",
        itens_com_duracao::int AS "itensComDuracao",tentativas_adicionais::int AS "tentativasAdicionais",
        itens_com_tentativas::int AS "itensComTentativas"
      FROM vw_metricas_pipeline_diarias WHERE dia BETWEEN ${q.dataInicio}::date AND ${q.dataFim}::date
      AND (${q.processamento ?? null}::text IS NULL OR processamento=${q.processamento ?? null})
      AND (${q.escopo ?? null}::text IS NULL OR escopo=${q.escopo ?? null})
      ORDER BY dia,processamento,escopo
    `;
    const serie = rows.map((r) => PipelineSerieSchema.parse(r));
    const errosPorTipoRetidos = await this.db.$queryRaw<
      Array<{ tipoErro: string; total: number }>
    >`
      SELECT COALESCE(v.tipo_erro,'DESCONHECIDO') AS "tipoErro",COUNT(*)::int AS total
      FROM vw_pipeline_itens v WHERE ${itemFilters({ ...q, status: "ERRO" })}
      GROUP BY v.tipo_erro ORDER BY total DESC
    `;
    const sucessos = serie.reduce((n, r) => n + r.sucessos, 0),
      falhas = serie.reduce((n, r) => n + r.falhas, 0);
    return {
      serie,
      errosPorTipoRetidos,
      resumo: {
        processados: sucessos + falhas,
        sucessos,
        falhas,
        taxaSucesso:
          sucessos + falhas ? (100 * sucessos) / (sucessos + falhas) : null,
      },
    };
  }
  async executions(q: PipelineQuery) {
    const { skip } = getPagination({ page: q.pagina, size: q.limite });
    const filter = Prisma.sql`(p.data_inicio AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date
      BETWEEN ${q.dataInicio}::date AND ${q.dataFim}::date
      AND (${q.escopo ?? null}::text IS NULL OR COALESCE(p.metadata->>'scope','nao_informado')=${q.escopo ?? null})
      AND (${q.processamento ?? null}::text IS NULL OR EXISTS
        (SELECT 1 FROM vw_pipeline_itens v WHERE v.pipeline_log_id=p.id AND v.processamento=${q.processamento ?? null}))`;
    const [dados, count] = await this.db.$transaction(
      [
        this.db
          .$queryRaw`SELECT p.id,p.modulo::text,p.status::text,p.metadata->>'scope' AS escopo,
        p.data_inicio::text AS inicio,p.data_fim::text AS fim,p.duracao_ms AS "duracaoMs",
        p.registros_processados AS processados,p.quantidade_sucessos AS sucessos,p.quantidade_erros AS falhas
        FROM pipeline_log p WHERE ${filter} ORDER BY p.data_inicio DESC,p.id
        LIMIT ${q.limite} OFFSET ${skip}`,
        this.db.$queryRaw<
          Array<{ total: number }>
        >`SELECT COUNT(*)::int AS total FROM pipeline_log p WHERE ${filter}`,
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return PipelineExecucoesSchema.parse({
      dados,
      total: count[0].total,
      pagina: q.pagina,
      limite: q.limite,
    });
  }
  async items(q: PipelineQuery, pipelineId?: string) {
    const { skip } = getPagination({ page: q.pagina, size: q.limite });
    const filter = Prisma.sql`${itemFilters(q)} AND
      (${pipelineId ?? null}::text IS NULL OR v.pipeline_log_id=${pipelineId ?? null})`;
    const [dados, count] = await this.db.$transaction(
      [
        this.db
          .$queryRaw`SELECT v.id,v.pipeline_log_id AS "pipelineLogId",v.entidade_id AS "entidadeId",v.etapa,
        v.status,v.tipo_erro AS "tipoErro",v.mensagem_erro AS "mensagemErro",v.tempo_ms::float8 AS "tempoMs",
        v.encerrado_em::text AS "encerradoEm",v.tentativas
        FROM vw_pipeline_itens v WHERE ${filter} ORDER BY v.encerrado_em DESC,v.id
        LIMIT ${q.limite} OFFSET ${skip}`,
        this.db.$queryRaw<
          Array<{ total: number }>
        >`SELECT COUNT(*)::int AS total FROM vw_pipeline_itens v WHERE ${filter}`,
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return PipelineItensSchema.parse({
      dados,
      total: count[0].total,
      pagina: q.pagina,
      limite: q.limite,
    });
  }
  async execution(id: string) {
    const row = await this.db.pipelineLog.findUnique({
      where: { id },
      select: {
        id: true,
        modulo: true,
        status: true,
        dataInicio: true,
        dataFim: true,
        duracaoMs: true,
        metadata: true,
        registrosProcessados: true,
        quantidadeSucessos: true,
        quantidadeErros: true,
      },
    });
    if (!row)
      throw new NotFoundException(
        "Execução não encontrada ou fora do período de retenção.",
      );
    const meta = row.metadata as Record<string, unknown> | null;
    return {
      id: row.id,
      modulo: row.modulo,
      status: row.status,
      escopo: typeof meta?.scope === "string" ? meta.scope : null,
      inicio: row.dataInicio.toISOString(),
      fim: row.dataFim?.toISOString() ?? null,
      duracaoMs: row.duracaoMs,
      processados: row.registrosProcessados,
      sucessos: row.quantidadeSucessos,
      falhas: row.quantidadeErros,
    };
  }
}
