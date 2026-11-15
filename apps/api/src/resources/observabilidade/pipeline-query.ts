import { Prisma } from "@oda/database";
import type { PipelineQuery } from "@oda/shared-types";
export function itemFilters(q: PipelineQuery) {
  return Prisma.sql`v.dia BETWEEN ${q.dataInicio}::date AND ${q.dataFim}::date
    AND (${q.processamento ?? null}::text IS NULL OR v.processamento=${q.processamento ?? null})
    AND (${q.escopo ?? null}::text IS NULL OR v.escopo=${q.escopo ?? null})
    AND (${q.status ?? null}::text IS NULL OR v.status=${q.status ?? null})`;
}
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
