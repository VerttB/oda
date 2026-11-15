import { ServiceUnavailableException } from "@nestjs/common";
import {
  FilaStatusResponseSchema,
  FilasStatusResponseSchema,
  FilaStatusNomeSchema,
} from "@oda/shared-types";
import {
  FILAS_STATUS_TIMEOUT_MS,
  FilasStatusService,
} from "./filas-status.service";
import { statusQueuesMock } from "../../../test/fixtures/filas-status";

describe("FilasStatusService", () => {
  let queues: ReturnType<typeof statusQueuesMock>;
  let service: FilasStatusService;

  beforeEach(() => {
    queues = statusQueuesMock();
    service = new FilasStatusService(queues);
  });

  it("consulta todas as filas, incluindo SIMCC, IA e manutenção, sem misturar contadores", async () => {
    queues["etl-pesquisadores"].getJobCounts.mockResolvedValue({
      waiting: 2000,
      active: 1,
      failed: 7,
    });
    queues["etl-pesquisadores"].getGlobalConcurrency.mockResolvedValue(1);
    queues["etl-grupos-simcc"].getJobCounts.mockResolvedValue({ waiting: 9 });
    queues.ia.getJobCounts.mockResolvedValue({ active: 2 });
    const response = FilasStatusResponseSchema.parse(await service.findAll());
    expect(response.total).toBe(11);
    expect(response.filas.map((item) => item.fila)).toEqual(
      FilaStatusNomeSchema.options,
    );
    expect(
      response.filas.find((item) => item.fila === "etl-pesquisadores"),
    ).toMatchObject({
      estado: "PROCESSANDO",
      concorrenciaGlobal: 1,
      contadores: { waiting: 2000, active: 1, failed: 7 },
    });
    expect(
      response.filas.find((item) => item.fila === "etl-grupos"),
    ).toMatchObject({ contadores: { waiting: 0 } });
    expect(
      response.filas.find((item) => item.fila === "etl-grupos-simcc"),
    ).toMatchObject({ contadores: { waiting: 9 } });
    for (const queue of Object.values(queues))
      expect(queue.getGlobalConcurrency).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      pausada: true,
      workers: 1,
      counts: { active: 1, paused: 3 },
      estado: "PAUSADA",
    },
    {
      pausada: false,
      workers: 0,
      counts: { active: 1 },
      estado: "PROCESSANDO",
    },
    {
      pausada: false,
      workers: 0,
      counts: { waiting: 2000 },
      estado: "SEM_WORKERS",
    },
    { pausada: false, workers: 0, counts: {}, estado: "SEM_WORKERS" },
    {
      pausada: false,
      workers: 1,
      counts: { waiting: 1 },
      estado: "AGUARDANDO",
    },
    {
      pausada: false,
      workers: 1,
      counts: { prioritized: 1 },
      estado: "AGUARDANDO",
    },
    {
      pausada: false,
      workers: 1,
      counts: { delayed: 1 },
      estado: "AGUARDANDO",
    },
    {
      pausada: false,
      workers: 1,
      counts: { "waiting-children": 1 },
      estado: "AGUARDANDO",
    },
    {
      pausada: false,
      workers: 1,
      counts: { failed: 10, completed: 100 },
      estado: "OCIOSA",
    },
  ])(
    "classifica $estado com $counts e $workers workers",
    async ({ pausada, workers, counts, estado }) => {
      const queue = queues["etl-pesquisadores"];
      queue.isPaused.mockResolvedValue(pausada);
      queue.getWorkers.mockResolvedValue(
        Array.from({ length: workers }, () => ({ id: "worker" })),
      );
      queue.getJobCounts.mockResolvedValue(counts);
      const response = FilaStatusResponseSchema.parse(
        await service.findOne("etl-pesquisadores"),
      );
      expect(response).toMatchObject({
        estado,
        pausada,
        workersAtivos: workers,
        concorrenciaGlobal: null,
      });
      expect(response.contadores.waitingChildren).toBe(
        counts["waiting-children"] ?? 0,
      );
    },
  );

  it("lê mudanças da concorrência no Redis a cada consulta", async () => {
    queues.lattes.getGlobalConcurrency
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    expect((await service.findOne("lattes")).concorrenciaGlobal).toBe(1);
    expect((await service.findOne("lattes")).concorrenciaGlobal).toBe(2);
  });

  it("retorna 503 quando uma leitura falha, sem apresentar contadores zero ou o erro interno", async () => {
    queues["etl-grupos"].getGlobalConcurrency.mockRejectedValue(
      new Error("erro interno confidencial"),
    );
    await expect(service.findOne("etl-grupos")).rejects.toThrow(
      "Não foi possível consultar a fila etl-grupos.",
    );
    await expect(service.findAll()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("limita a espera por comandos que não respondem", async () => {
    jest.useFakeTimers();
    try {
      queues.lattes.isPaused.mockReturnValue(new Promise(() => {}));
      const result = expect(service.findOne("lattes")).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await jest.advanceTimersByTimeAsync(FILAS_STATUS_TIMEOUT_MS);
      await result;
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("encerra apenas a conexão adicional de IA, preservando as conexões compartilhadas", async () => {
    await service.onModuleDestroy();
    expect(queues.ia.close).toHaveBeenCalledTimes(1);
    expect(queues.dgp.close).not.toHaveBeenCalled();
  });
});
