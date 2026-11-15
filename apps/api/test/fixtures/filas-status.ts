import { FilaStatusNomeSchema, type FilaStatusNome } from "@oda/shared-types";

// Somente para testes; nenhuma fila ou conexão Redis é criada.
export function statusQueueMock() {
  return {
    isPaused: jest.fn().mockResolvedValue(false),
    getWorkers: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({}),
    getGlobalConcurrency: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

export function statusQueuesMock() {
  return Object.fromEntries(
    FilaStatusNomeSchema.options.map((fila) => [fila, statusQueueMock()]),
  ) as Record<FilaStatusNome, ReturnType<typeof statusQueueMock>>;
}
