import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createDgpScraperQueue } from "@oda/queue";
import {
  FilaEstadoJobSchema,
  FilaStatusNomeSchema,
  type FilaEstadoOperacional,
  type FilaStatusNome,
  type FilaStatusResponse,
  type FilasStatusResponse,
} from "@oda/shared-types";

export const FILAS_STATUS_QUEUES = Symbol("FILAS_STATUS_QUEUES");
export const AI_STATUS_QUEUE = Symbol("AI_STATUS_QUEUE");
export const FILAS_STATUS_TIMEOUT_MS = 3_000;
export type QueueStatusReader = Pick<
  ReturnType<typeof createDgpScraperQueue>,
  "getJobCounts" | "getWorkers" | "getGlobalConcurrency" | "isPaused" | "close"
>;
export type FilasStatusQueues = Record<FilaStatusNome, QueueStatusReader>;

@Injectable()
export class FilasStatusService implements OnModuleDestroy {
  constructor(
    @Inject(FILAS_STATUS_QUEUES) private readonly queues: FilasStatusQueues,
  ) {}

  async onModuleDestroy() {
    // As demais conexões são compartilhadas e encerradas pelo FilasService.
    await this.queues.ia.close();
  }

  async findAll(): Promise<FilasStatusResponse> {
    const filas = await Promise.all(
      FilaStatusNomeSchema.options.map((fila) => this.findOne(fila)),
    );
    return { total: filas.length, filas };
  }

  async findOne(fila: FilaStatusNome): Promise<FilaStatusResponse> {
    const queue = this.queues[fila];
    if (!queue)
      throw new NotFoundException("Fila não cadastrada para monitoramento.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.readStatus(fila, queue),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Redis timeout")),
            FILAS_STATUS_TIMEOUT_MS,
          );
        }),
      ]);
    } catch {
      // Não converte indisponibilidade em contadores zerados nem expõe detalhes da conexão.
      throw new ServiceUnavailableException(
        `Não foi possível consultar a fila ${fila}. Tente novamente.`,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async readStatus(
    fila: FilaStatusNome,
    queue: QueueStatusReader,
  ): Promise<FilaStatusResponse> {
    const [pausada, workers, counts, concorrenciaGlobal] = await Promise.all([
      queue.isPaused(),
      queue.getWorkers(),
      queue.getJobCounts(...FilaEstadoJobSchema.options),
      queue.getGlobalConcurrency(),
    ]);
    const contadores = {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      paused: counts.paused ?? 0,
      prioritized: counts.prioritized ?? 0,
      waitingChildren: counts["waiting-children"] ?? 0,
    };
    const pendentes =
      contadores.waiting +
      contadores.delayed +
      contadores.paused +
      contadores.prioritized +
      contadores.waitingChildren;
    let estado: FilaEstadoOperacional;
    if (pausada) estado = "PAUSADA";
    else if (contadores.active > 0) estado = "PROCESSANDO";
    else if (workers.length === 0) estado = "SEM_WORKERS";
    else if (pendentes > 0) estado = "AGUARDANDO";
    else estado = "OCIOSA";
    return {
      fila,
      estado,
      pausada,
      workersAtivos: workers.length,
      concorrenciaGlobal: concorrenciaGlobal ?? null,
      contadores,
      consultadoEm: new Date().toISOString(),
    };
  }
}
