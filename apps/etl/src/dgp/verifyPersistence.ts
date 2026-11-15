import type { PrismaClient } from "@oda/database";
import { EtlInputError } from "../commom/etlFile";
const normalized = (v: string) => v.trim().toLocaleLowerCase("pt-BR");
export async function verifyGroupPersistence(db: PrismaClient, data: any) {
  const group = await db.grupoPesquisa.findUniqueOrThrow({
    where: { dgpId: data.idDgp },
    select: {
      membros: {
        select: { pesquisador: { select: { nome: true, lattesId: true } } },
      },
      linhasPesquisa: { select: { titulo: true } },
    },
  });
  const members = Array.isArray(data.membros)
    ? data.membros.filter((m) => typeof m.nome === "string" && m.nome.trim())
    : [];
  const lines = Array.isArray(data.linhas)
    ? data.linhas.filter((l) => typeof l.nome === "string" && l.nome.trim())
    : [];
  const absentMembers = members.filter(
    (m) =>
      !group.membros.some(({ pesquisador: p }) =>
        m.lattes?.trim()
          ? p.lattesId === m.lattes.trim()
          : normalized(p.nome) === normalized(m.nome),
      ),
  );
  const absentLines = lines.filter(
    (l) =>
      !group.linhasPesquisa.some(
        (p) => normalized(p.titulo) === normalized(l.nome),
      ),
  );
  const result = {
    membrosJsonValidos: members.length,
    membrosPersistidos: group.membros.length,
    linhasJsonValidas: lines.length,
    linhasPersistidas: group.linhasPesquisa.length,
    membrosAusentes: absentMembers.length,
    linhasAusentes: absentLines.length,
    membrosSemIdentificador: members.filter((m) => !m.lattes?.trim()).length,
  };
  if (result.membrosAusentes || result.linhasAusentes) {
    throw new EtlInputError(
      "Conferência JSON/banco falhou: " + JSON.stringify(result),
    );
  }
  return result;
}
