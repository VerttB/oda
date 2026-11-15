import type { Consistency } from "#/api/observabilidade";
export function ConsistencySummary({ report }: { report: Consistency }) {
  const result = report.resultado;
  return (
    <div className="space-y-3">
      <p>
        {report.estado} · {report.finalizadoEm}
      </p>
      {report.estado === "PARCIAL" && (
        <p className="text-amber-800">
          A carga terminou com falhas. Os dados abaixo representam uma
          atualização parcial.
        </p>
      )}
      {result && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Antes</th>
                  <th>Depois</th>
                  <th>Variação</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {result.metricas.map((m) => (
                  <tr key={m.metrica} className="border-b">
                    <td className="py-2">{m.metrica}</td>
                    <td>{m.antes}</td>
                    <td>{m.depois}</td>
                    <td>
                      {m.variacaoPercentual === null
                        ? "Nova base"
                        : m.variacaoPercentual.toFixed(1) + "%"}
                    </td>
                    <td>{m.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>{result.alertas.length} {result.alertas.length===1?'alerta':'alertas'} para conferência.</p>
          <ul className="max-h-64 overflow-auto text-sm">
            {result.alertas.map((a, index) => (
              <li className="border-b py-2" key={a.regra + a.dgpId + index}>
                <strong>{a.dgpId ?? "Sem identificador"}</strong>: {a.mensagem}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
