import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../generated/prisma";
import { SIMCC_INSTITUICOES_WHERE } from "./simcc";
type Db = PrismaClient | Prisma.TransactionClient;
type GroupSnapshot = {
  dgpId: string | null;
  nome: string;
  situacao: string;
  membros: number;
  linhas: number;
  lideres: number;
  membrosComLattes: number;
  sedes: number;
  sedesSimcc: number;
  areaPrincipal: boolean;
};
type Snapshot = { idsEsperados: string[]; grupos: GroupSnapshot[] };
export type ConsistencyAlert = {
  dgpId: string | null;
  regra: string;
  mensagem: string;
};

export function compareConsistency(before: Snapshot, after: Snapshot) {
  const totals = (value: Snapshot) => ({
    grupos: value.grupos.length,
    vinculosMembros: value.grupos.reduce((n, g) => n + g.membros, 0),
    linhas: value.grupos.reduce((n, g) => n + g.linhas, 0),
    membrosComLattes: value.grupos.reduce((n, g) => n + g.membrosComLattes, 0),
  });
  const old = totals(before),
    current = totals(after);
  const metricas = Object.entries(current).map(([metrica, depois]) => {
    const antes = old[metrica as keyof typeof old],
      diferenca = depois - antes;
    const variacaoPercentual = antes
      ? (diferenca / antes) * 100
      : depois === 0
        ? 0
        : null;
    return {
      metrica,
      antes,
      depois,
      diferenca,
      variacaoPercentual,
      estado:
        diferenca === 0
          ? "SEM_ALTERACAO"
          : antes === 0
            ? "NOVA_BASE"
            : variacaoPercentual! <= -5 || variacaoPercentual! >= 10
              ? "ALERTA"
              : "NORMAL",
    };
  });
  const alertas: ConsistencyAlert[] = [];
  const found = new Set(after.grupos.map((g) => g.dgpId));
  for (const id of before.idsEsperados)
    if (!found.has(id)) {
      alertas.push({
        dgpId: id,
        regra: "GRUPO_AUSENTE",
        mensagem: "Grupo esperado não encontrado após a carga.",
      });
    }
  const previous = new Map(before.grupos.map((g) => [g.dgpId, g]));
  for (const g of after.grupos) {
    const add = (regra: string, mensagem: string) =>
      alertas.push({ dgpId: g.dgpId, regra, mensagem });
    if (!g.dgpId || !/^\d{16}$/.test(g.dgpId) || /^0+$/.test(g.dgpId))
      add("ID_INVALIDO", "Identificador DGP ausente ou inválido.");
    if (!g.nome.trim() || g.nome === "N/A")
      add("NOME_INVALIDO", "Nome do grupo ausente ou inválido.");
    if (g.sedes !== 1)
      add(
        "SEDE_INVALIDA",
        "Grupo deve possuir exatamente uma instituição sede.",
      );
    if (!g.sedesSimcc)
      add(
        "FORA_SIMCC",
        "Grupo esperado deixou de possuir sede elegível ao SIMCC.",
      );
    if (!g.areaPrincipal) add("SEM_AREA", "Grupo sem área principal.");
    if (!g.lideres) add("SEM_LIDER", "Grupo sem líder cadastrado.");
    if (!g.membros) add("SEM_MEMBROS", "Grupo sem membros cadastrados.");
    if (!g.linhas) add("SEM_LINHAS", "Grupo sem linhas cadastradas.");
    const p = previous.get(g.dgpId);
    if (p && (g.membros < p.membros || g.linhas < p.linhas))
      add(
        "REDUCAO_VINCULOS",
        "Houve redução de membros ou linhas; conferir a fonte.",
      );
  }
  return {
    metricas,
    alertas,
    limites: { reducaoPercentual: 5, aumentoPercentual: 10 },
  };
}

async function snapshot(db: Db, expected: string[] = []): Promise<Snapshot> {
  const rows = await db.grupoPesquisa.findMany({
    where: {
      OR: [
        {
          instituicoes: {
            some: {
              tipoRelacao: "SEDE",
              instituicao: SIMCC_INSTITUICOES_WHERE,
            },
          },
        },
        ...(expected.length ? [{ dgpId: { in: expected } }] : []),
      ],
    },
    select: {
      dgpId: true,
      nome: true,
      situacao: true,
      areaConhecimentoId: true,
      _count: { select: { linhasPesquisa: true } },
      instituicoes: {
        where: { tipoRelacao: "SEDE" },
        select: { instituicaoId: true },
      },
      membros: {
        select: { eLider: true, pesquisador: { select: { lattesId: true } } },
      },
    },
  });
  const eligible = await db.instituicao.findMany({
    where: SIMCC_INSTITUICOES_WHERE,
    select: { id: true },
  });
  const institutionIds = new Set(eligible.map((i) => i.id));
  return {
    idsEsperados: [
      ...new Set([
        ...expected,
        ...rows.flatMap((g) => (g.dgpId ? [g.dgpId] : [])),
      ]),
    ],
    grupos: rows.map((g) => ({
      dgpId: g.dgpId,
      nome: g.nome,
      situacao: g.situacao,
      membros: g.membros.length,
      linhas: g._count.linhasPesquisa,
      lideres: g.membros.filter((m) => m.eLider).length,
      membrosComLattes: g.membros.filter((m) =>
        /^\d{16}$/.test(m.pesquisador.lattesId ?? ""),
      ).length,
      sedes: g.instituicoes.length,
      sedesSimcc: g.instituicoes.filter((i) =>
        institutionIds.has(i.instituicaoId),
      ).length,
      areaPrincipal: !!g.areaConhecimentoId,
    })),
  };
}

export async function startSimccConsistency(
  db: Db,
  pipelineId: string,
  ids: string[],
) {
  const before = await snapshot(db, ids);
  await db.$executeRaw`
    INSERT INTO relatorio_consistencia(id,pipeline_log_id,escopo,antes)
    VALUES (${randomUUID()},${pipelineId},'simcc',${JSON.stringify(before)}::jsonb)
    ON CONFLICT(pipeline_log_id) DO NOTHING
  `;
}

export async function finishSimccConsistency(
  db: PrismaClient,
  pipelineId: string,
) {
  const rows = await db.$queryRaw<
    Array<{ id: string; antes: Snapshot; status: string }>
  >`
    SELECT r.id,r.antes,p.status::text FROM relatorio_consistencia r
    JOIN pipeline_log p ON p.id=r.pipeline_log_id
    WHERE r.pipeline_log_id=${pipelineId} AND r.estado='EM_ANDAMENTO' AND p.data_fim IS NOT NULL
  `;
  const row = rows[0];
  if (!row) return;
  const after = await snapshot(db, row.antes.idsEsperados);
  const result = compareConsistency(row.antes, after);
  await db.$executeRaw`
    UPDATE relatorio_consistencia SET depois=${JSON.stringify(after)}::jsonb,
      resultado=${JSON.stringify(result)}::jsonb, finalizado_em=now(),
      estado=${row.status === "CONCLUIDO" ? "CONCLUIDO" : "PARCIAL"}
    WHERE id=${row.id} AND estado='EM_ANDAMENTO'
  `;
}

export async function finishPendingSimccConsistency(db: PrismaClient) {
  const rows = await db.$queryRaw<Array<{ pipeline_log_id: string }>>`
    SELECT r.pipeline_log_id FROM relatorio_consistencia r JOIN pipeline_log p ON p.id=r.pipeline_log_id
    WHERE r.estado='EM_ANDAMENTO' AND p.data_fim IS NOT NULL ORDER BY p.data_fim LIMIT 20
  `;
  for (const row of rows) await finishSimccConsistency(db, row.pipeline_log_id);
}
