import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { observe, exportLogs, ObservationError } from "#/api/observabilidade";
import { ConsistencySummary } from "./ConsistencySummary";
import type {
  Metrics,
  Executions,
  Items,
  Queues,
  Consistency,
} from "#/api/observabilidade";

export function AdminPipelineView({
  onToast,
  searchQuery = "",
}: {
  onToast: (s: string) => void;
  searchQuery?: string;
}) {
  const [filters, setFilters] = useState(() => {
    const q = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    );
    return {
      dataInicio:
        q.get("dataInicio") ??
        new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dataFim: q.get("dataFim") ?? new Date().toISOString().slice(0, 10),
      processamento: q.get("processamento") ?? "",
      escopo: q.get("escopo") ?? "",
    };
  });
  const [pagina, setPagina] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [itemPage, setItemPage] = useState(1);
  const [paused, setPaused] = useState(false);
  const [exporting, setExporting] = useState(false);
  const q = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString();
  function change(key: keyof typeof filters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setPagina(1);
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(next))
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k);
    window.history.replaceState(null, "", url);
  }
  const metrics = useQuery({
    queryKey: ["admin", "metrics", q],
    queryFn: () => observe<Metrics>("/admin/logs/metricas?" + q),
    refetchInterval: paused ? false : 30000,
  });
  const executions = useQuery({
    queryKey: ["admin", "executions", q, pagina],
    queryFn: () =>
      observe<Executions>(`/admin/logs/execucoes?${q}&pagina=${pagina}`),
    refetchInterval: paused ? false : 30000,
  });
  const queues = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => observe<Queues>("/admin/filas"),
    refetchInterval: paused ? false : 15000,
  });
  const items = useQuery({
    queryKey: ["admin", "pipeline-items", selected, q, itemPage],
    enabled: !!selected,
    queryFn: () =>
      observe<Items>(
        `/admin/logs/execucoes/${selected}/itens?${q}&pagina=${itemPage}`,
      ),
  });
  const consistency = useQuery({
    queryKey: ["admin", "consistency"],
    retry: false,
    queryFn: () => observe<Consistency>("/admin/consistencia-dados/ultima"),
  });
  const download = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      await exportLogs(q, format);
      onToast("Exportação concluída.");
    } catch (e) {
      onToast(String(e));
    } finally {
      setExporting(false);
    }
  };
  const maxVolume = Math.max(
    1,
    ...(metrics.data?.serie.map((r) => r.processados) ?? []),
  );
  const visible =
    executions.data?.dados.filter(
      (r) => !searchQuery || r.id.includes(searchQuery),
    ) ?? [];
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">
            Operação e qualidade dos dados
          </h1>
          <p className="text-sm text-slate-600">
            Resultados persistidos dos pipelines. Contadores de fila consultados
            no Redis.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-2"
            onClick={() => setPaused(!paused)}
          >
            {paused ? "Atualizar automaticamente" : "Pausar atualização"}
          </button>
          {(["csv", "json"] as const).map((f) => (
            <button
              key={f}
              disabled={exporting}
              onClick={() => void download(f)}
              className="rounded border px-3 py-2"
            >
              Exportar {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {(["dataInicio", "dataFim"] as const).map((key) => (
          <label key={key} className="text-sm">
            {key === "dataInicio" ? "De" : "Até"}
            <input
              aria-label={key === "dataInicio" ? "Data inicial" : "Data final"}
              className="ml-2 rounded border p-2"
              type="date"
              value={filters[key]}
              onChange={(e) => change(key, e.target.value)}
            />
          </label>
        ))}
        <select
          aria-label="Processamento"
          className="rounded border p-2"
          value={filters.processamento}
          onChange={(e) => change("processamento", e.target.value)}
        >
          <option value="">Todos os processamentos</option>
          {[
            "SCRAPER_DGP",
            "SCRAPER_LATTES",
            "DESCOBERTA",
            "ETL_GRUPOS",
            "ETL_PESQUISADORES",
          ].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Escopo"
          className="rounded border p-2"
          value={filters.escopo}
          onChange={(e) => change("escopo", e.target.value)}
        >
          <option value="">Todos os escopos</option>
          <option value="default">Geral</option>
          <option value="simcc">SIMCC</option>
          <option value="nao_informado">Legado sem escopo</option>
        </select>
      </div>
      {metrics.isPending ? (
        <p>Carregando métricas…</p>
      ) : metrics.error ? (
        <p role="alert">{metrics.error.message}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries({
            Processados: metrics.data?.resumo.processados,
            Sucessos: metrics.data?.resumo.sucessos,
            Falhas: metrics.data?.resumo.falhas,
            "Taxa de sucesso":
              metrics.data?.resumo.taxaSucesso == null
                ? "Sem dados"
                : metrics.data.resumo.taxaSucesso.toFixed(1) + "%",
          }).map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-white p-4">
              <p className="text-sm text-slate-600">{k}</p>
              <strong className="text-2xl">{v}</strong>
            </div>
          ))}
        </div>
      )}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Volume diário</h2>
        {!metrics.data?.serie.length && <p>Sem resultados no período.</p>}
        <div className="max-h-72 overflow-auto">
          {metrics.data?.serie.map((r) => (
            <div
              key={r.dia + r.processamento + r.escopo}
              className="mb-2 text-sm"
            >
              <div className="flex justify-between gap-2">
                <span>
                  {r.dia} · {r.processamento} · {r.escopo}
                </span>
                <span>
                  {r.sucessos} sucessos / {r.falhas} falhas
                </span>
              </div>
              <div
                className="flex h-2 overflow-hidden rounded bg-slate-100"
                style={{ width: (100 * r.processados) / maxVolume + "%" }}
              >
                <div
                  className="bg-emerald-500"
                  style={{
                    width: r.processados
                      ? (100 * r.sucessos) / r.processados + "%"
                      : "0%",
                  }}
                />
                <div
                  className="bg-red-400"
                  style={{
                    width: r.processados
                      ? (100 * r.falhas) / r.processados + "%"
                      : "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Erros por categoria</h2>
        <p className="text-sm">
          Detalhes ainda disponíveis no período de retenção.
        </p>
        <ul>
          {metrics.data?.errosPorTipoRetidos.map((e) => (
            <li key={e.tipoErro}>
              {e.tipoErro}: {e.total}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Filas agora</h2>
        {queues.error ? (
          <p role="alert">
            {queues.error.message} O histórico permanece disponível.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {queues.data?.filas.map((r) => (
              <div className="rounded border bg-white p-3 text-sm" key={r.fila}>
                <strong>{r.fila}</strong>
                <p>
                  {r.estado} · {r.workersAtivos} workers
                </p>
                <p>
                  {r.contadores.waiting +
                    r.contadores.prioritized +
                    r.contadores.paused}{" "}
                  aguardando · {r.contadores.active} ativos ·{" "}
                  {r.contadores.failed} falhos
                </p>
                <p>
                  Limite global: {r.concorrenciaGlobal ?? "Não configurado"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="overflow-x-auto">
        <h2 className="mb-2 text-lg font-semibold">Execuções</h2>
        {executions.error ? (
          <p role="alert">{executions.error.message}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Execução</th>
                <th>Início</th>
                <th>Status</th>
                <th>Sucessos / falhas</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr className="border-b" key={r.id}>
                  <td className="max-w-48 break-all p-2">{r.id}</td>
                  <td>{r.inicio}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.sucessos} / {r.falhas}
                  </td>
                  <td>
                    <button
                      className="text-cyan-800 underline"
                      onClick={() => {
                        setItemPage(1);
                        setSelected(r.id);
                      }}
                    >
                      Ver itens
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {executions.data?.total === 0 && <p>Nenhuma execução no período.</p>}
        <div className="mt-3 flex gap-3">
          <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </button>
          <span>Página {pagina}</span>
          <button
            disabled={
              !executions.data ||
              pagina * executions.data.limite >= executions.data.total
            }
            onClick={() => setPagina(pagina + 1)}
          >
            Próxima
          </button>
        </div>
      </section>
      {selected && (
        <section className="rounded border p-4">
          <h2 className="font-semibold">Itens de {selected}</h2>
          <button onClick={() => setSelected(null)}>Fechar</button>
          {items.error ? (
            <p role="alert">{items.error.message}</p>
          ) : (
            <ul>
              {items.data?.dados.map((i) => (
                <li key={i.id} className="border-b py-2 text-sm">
                  {i.entidadeId} · {i.status} · {i.etapa}
                  <p className="break-words">{i.mensagemErro}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-3">
            <button
              disabled={itemPage === 1}
              onClick={() => setItemPage(itemPage - 1)}
            >
              Anterior
            </button>
            <span>Página {itemPage}</span>
            <button
              disabled={
                !items.data || itemPage * items.data.limite >= items.data.total
              }
              onClick={() => setItemPage(itemPage + 1)}
            >
              Próxima
            </button>
          </div>
        </section>
      )}
      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Consistência SIMCC</h2>
        {consistency.data ? (
          <ConsistencySummary report={consistency.data} />
        ) : (
          <p>
            {consistency.isPending
              ? "Consultando relatório…"
              : consistency.error instanceof ObservationError &&
                  consistency.error.status === 404
                ? "Nenhum relatório encerrado. A primeira carga SIMCC monitorada produzirá o histórico."
                : (consistency.error?.message ?? "Relatório indisponível.")}
          </p>
        )}
      </section>
    </div>
  );
}
