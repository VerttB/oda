import type {
  PipelineMetricasResponse,
  PipelineExecucoesResponse,
  PipelineItensResponse,
  FilasStatusResponse,
  ConsistenciaRelatorioResponse,
} from "@oda/shared-types";
import { API_BASE_URL } from "./config";
import { getAuthHeaders, clearAuthToken } from "./auth";
export type Metrics = PipelineMetricasResponse;
export type Executions = PipelineExecucoesResponse;
export type Items = PipelineItensResponse;
export type Queues = FilasStatusResponse;
export type Consistency = ConsistenciaRelatorioResponse;
export class ObservationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function observe<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE_URL + path, { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearAuthToken();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("oda:auth-expired"));
    }
    throw new ObservationError(
      res.status,
      res.status === 401
        ? "Sessão administrativa expirada."
        : `Consulta indisponível (${res.status}).`,
    );
  }
  return res.json();
}
export async function exportLogs(query: string, format: "csv" | "json") {
  const res = await fetch(
    API_BASE_URL + "/admin/logs/exportacao?" + query + "&formato=" + format,
    { headers: getAuthHeaders() },
  );
  if (!res.ok) throw new Error("Não foi possível exportar os logs.");
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "oda-pipelines." + format;
  link.click();
  URL.revokeObjectURL(url);
}
