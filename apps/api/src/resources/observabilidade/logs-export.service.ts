import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import type { PipelineQuery } from "@oda/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { itemFilters, csvCell } from "./pipeline-query";
@Injectable()
export class LogsExportService {
  constructor(private readonly db: PrismaService) {}
  async export(q: PipelineQuery, format: "csv" | "json", res: Response) {
    const started = new Date();
    res.setHeader(
      "Content-Type",
      format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/json; charset=utf-8",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="oda-pipelines.${format}"`,
    );
    const fields = [
      "id",
      "pipelineLogId",
      "entidadeId",
      "processamento",
      "escopo",
      "status",
      "tipoErro",
      "mensagemErro",
      "tempoMs",
      "encerradoEm",
    ];
    const write = async (text: string) => {
      if (res.destroyed) return;
      if (!res.write(text))
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            res.off("drain", done);
            res.off("close", done);
            res.off("error", fail);
          };
          const done = () => {
            cleanup();
            resolve();
          };
          const fail = (error: Error) => {
            cleanup();
            reject(error);
          };
          res.once("drain", done);
          res.once("close", done);
          res.once("error", fail);
        });
    };
    await write(
      format === "csv" ? "\uFEFF" + fields.map(csvCell).join(",") + "\n" : "[",
    );
    let cursor = "",
      first = true;
    while (!res.destroyed) {
      const rows = await this.db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT v.id,v.pipeline_log_id AS "pipelineLogId",v.entidade_id AS "entidadeId",v.processamento,
          v.escopo,v.status,v.tipo_erro AS "tipoErro",v.mensagem_erro AS "mensagemErro",
          v.tempo_ms::float8 AS "tempoMs",v.encerrado_em::text AS "encerradoEm"
        FROM vw_pipeline_itens v WHERE ${itemFilters(q)} AND v.id>${cursor} AND v.encerrado_em<=${started}
        ORDER BY v.id LIMIT 500
      `;
      if (!rows.length) break;
      for (const row of rows) {
        await write(
          format === "csv"
            ? fields.map((f) => csvCell(row[f])).join(",") + "\n"
            : (first ? "" : ",") + JSON.stringify(row),
        );
        first = false;
      }
      cursor = String(rows[rows.length - 1].id);
    }
    if (!res.destroyed) res.end(format === "json" ? "]" : undefined);
  }
}
