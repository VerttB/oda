import { freemem, totalmem, loadavg, availableParallelism } from "node:os";
import { readFileSync } from "node:fs";
export const ADAPTIVE_ETL = {
  min: 1,
  max: 2,
  high: 1000,
  low: 300,
  samples: 3,
  intervalMs: 30000,
  cooldownMs: 300000,
};
export type CapacitySample = {
  waiting: number;
  memoryFreeRatio: number;
  cpuLoadRatio: number;
  databaseReady: boolean;
};
export function capacityResources() {
  let memoryFreeRatio = freemem() / totalmem();
  try {
    const max = Number(readFileSync("/sys/fs/cgroup/memory.max", "utf8"));
    const current = Number(
      readFileSync("/sys/fs/cgroup/memory.current", "utf8"),
    );
    if (Number.isFinite(max) && max > 0)
      memoryFreeRatio = Math.min(memoryFreeRatio, (max - current) / max);
  } catch {
    /* Sistemas sem cgroup usam a memória disponível do host. */
  }
  return {
    memoryFreeRatio,
    cpuLoadRatio: loadavg()[0] / availableParallelism(),
  };
}
export class AdaptiveEtlPolicy {
  current = 1;
  private highCount = 0;
  private lowCount = 0;
  private changedAt = 0;
  sample(s: CapacitySample, now = Date.now()) {
    const pressured =
      !s.databaseReady || s.memoryFreeRatio < 0.2 || s.cpuLoadRatio > 0.85;
    this.highCount =
      !pressured && s.waiting > ADAPTIVE_ETL.high ? this.highCount + 1 : 0;
    this.lowCount = s.waiting < ADAPTIVE_ETL.low ? this.lowCount + 1 : 0;
    const previous = this.current;
    if (pressured) this.current = 1;
    else if (now - this.changedAt >= ADAPTIVE_ETL.cooldownMs) {
      if (this.highCount >= ADAPTIVE_ETL.samples) this.current = 2;
      if (this.lowCount >= ADAPTIVE_ETL.samples) this.current = 1;
    }
    if (previous !== this.current) {
      this.changedAt = now;
      this.highCount = 0;
      this.lowCount = 0;
    }
    return {
      previous,
      current: this.current,
      changed: previous !== this.current,
      reason: pressured
        ? "RECURSOS"
        : this.current === 2
          ? "ACUMULO"
          : "FILA_REDUZIDA",
    };
  }
}
export function startAdaptiveEtl(
  worker: { concurrency: number },
  queue: { getJobCounts(...states: string[]): Promise<Record<string, number>> },
  databaseReady: () => Promise<boolean>,
) {
  const policy = new AdaptiveEtlPolicy();
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const counts = await queue.getJobCounts("waiting", "prioritized");
      const result = policy.sample({
        waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
        ...capacityResources(),
        databaseReady: await databaseReady(),
      });
      if (result.changed) {
        worker.concurrency = result.current;
        console.log("[ETL Capacidade]", { ...result, waiting: counts.waiting });
      }
    } catch (error) {
      worker.concurrency = 1;
      policy.current = 1;
      console.warn(
        "[ETL Capacidade] Consulta indisponível; capacidade reduzida.",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      busy = false;
    }
  }, ADAPTIVE_ETL.intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
