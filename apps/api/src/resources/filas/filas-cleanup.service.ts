import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createDgpScraperQueue } from "@oda/queue";
import type { FilaStatusNome, LimparFilaRequest } from "@oda/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  FILAS_STATUS_QUEUES,
  type FilasStatusQueues,
} from "./filas-status.service";

// Confere estado e payload na mesma operação que remove. Não remove jobs de flows.
// Evita a janela de corrida getState()/remove() que poderia atingir um job republicado.
export const REMOVE_TERMINAL_JOB = `
if not redis.call('ZSCORE',KEYS[1],ARGV[1]) then return 0 end
if redis.call('EXISTS',KEYS[2]..':lock')==1 then return 0 end
if redis.call('HGET',KEYS[2],'data')~=ARGV[2] then return 0 end
if redis.call('HEXISTS',KEYS[2],'parentKey')==1 then return 0 end
if redis.call('EXISTS',KEYS[2]..':dependencies',KEYS[2]..':processed',KEYS[2]..':failed',KEYS[2]..':unsuccessful')>0 then return 0 end
redis.call('ZREM',KEYS[1],ARGV[1])
redis.call('DEL',KEYS[2],KEYS[2]..':logs')
redis.call('XADD',KEYS[3],'MAXLEN','~',10000,'*','event','removed','jobId',ARGV[1],'prev',ARGV[3])
return 1
`;
type Queue = Pick<
  ReturnType<typeof createDgpScraperQueue>,
  "getJobs" | "client" | "toKey"
>;
@Injectable()
export class FilasCleanupService {
  constructor(
    @Inject(FILAS_STATUS_QUEUES) private readonly queues: FilasStatusQueues,
    private readonly db: PrismaService,
  ) {}
  async clean(fila: FilaStatusNome, input: LimparFilaRequest) {
    const q = this.queues[fila] as unknown as Queue;
    try {
      const jobs = await q.getJobs([input.estado], 0, input.limite - 1, true);
      const cutoff = Date.now() - input.maisAntigoQueHoras * 3600000;
      const result = {
        fila,
        simulacao: input.simular,
        examinados: jobs.length,
        elegiveis: 0,
        removidos: 0,
        ignorados: 0,
        ids: [] as string[],
      };
      for (const job of jobs) {
        if (!job.id || !job.finishedOn || job.finishedOn > cutoff) {
          result.ignorados++;
          continue;
        }
        const data = job.data as unknown as { pipelineItemId?: string };
        if (
          fila !== "ia" &&
          fila !== "system-maintenance" &&
          !fila.startsWith("etl-despacho")
        ) {
          const item = data.pipelineItemId
            ? await this.db.pipelineLogItem.findUnique({
                where: { id: data.pipelineItemId },
                select: { status: true },
              })
            : null;
          if (
            !item ||
            item.status !== (input.estado === "completed" ? "SUCESSO" : "ERRO")
          ) {
            result.ignorados++;
            continue;
          }
        }
        result.elegiveis++;
        if (input.simular) {
          result.ids.push(job.id);
          continue;
        }
        const client = (await q.client) as unknown as {
          eval(...args: Array<string | number>): Promise<unknown>;
        };
        const removed = await client.eval(
          REMOVE_TERMINAL_JOB,
          3,
          q.toKey(input.estado),
          q.toKey(job.id),
          q.toKey("events"),
          job.id,
          JSON.stringify(job.data),
          input.estado,
        );
        if (Number(removed) === 1) {
          result.removidos++;
          result.ids.push(job.id);
        } else result.ignorados++;
      }
      return result;
    } catch {
      throw new ServiceUnavailableException(
        "Não foi possível concluir a limpeza. Consulte os jobs antes de repetir.",
      );
    }
  }
}
