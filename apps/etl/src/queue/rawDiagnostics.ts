import { opendir, stat } from "node:fs/promises";
import path from "node:path";
import { getEtlDataPaths } from "../commom/config";
import { DataScope, etlGroupJobId, etlResearcherJobId } from "@oda/queue";
type Queue = {
  getJob(
    id: string,
  ): Promise<
    { getState(): Promise<string>; failedReason?: string } | undefined
  >;
};
export async function inspectRaw(
  scope: DataScope,
  groups: Queue,
  researchers: Queue,
  limit = 100,
) {
  const paths = getEtlDataPaths(scope);
  const result: {
    scope: DataScope;
    total: number;
    bytes: number;
    maisAntigoEm: string | null;
    amostra: Array<unknown>;
  } = {
    scope,
    total: 0,
    bytes: 0,
    maisAntigoEm: null,
    amostra: [],
  };
  for (const [kind, dir, queue] of [
    ["dgp", paths.dgpDir, groups],
    ["lattes", paths.lattesDir, researchers],
  ] as const) {
    if (scope === "simcc" && kind === "lattes") continue;
    let handle;
    try {
      handle = await opendir(dir);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw e;
    }
    for await (const file of handle) {
      if (!file.isFile() || !/^\d{16}\.json$/.test(file.name)) continue;
      const info = await stat(path.join(dir, file.name));
      result.total++;
      result.bytes += info.size;
      const date = info.mtime.toISOString();
      if (!result.maisAntigoEm || date < result.maisAntigoEm)
        result.maisAntigoEm = date;
      if (result.amostra.length >= limit) continue;
      const id = path.basename(file.name, ".json");
      const job = await queue.getJob(
        kind === "dgp" ? etlGroupJobId(id) : etlResearcherJobId(id),
      );
      result.amostra.push({
        tipo: kind,
        arquivo: file.name,
        bytes: info.size,
        modificadoEm: date,
        estado: job ? await job.getState() : "SEM_JOB",
        erro: job?.failedReason ?? null,
      });
    }
  }
  return result;
}
