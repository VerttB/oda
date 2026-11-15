import { z } from "zod";
import { FilaContadoresSchema, FilaNomeSchema } from "./filas";

// A IA participa do monitoramento, sem liberar suas operações nas rotas de manutenção.
export const FilaStatusNomeSchema = z.enum([...FilaNomeSchema.options, "ia"]);
export const FilaStatusParamSchema = z.object({ fila: FilaStatusNomeSchema });
export const FilaEstadoOperacionalSchema = z
  .enum(["PAUSADA", "PROCESSANDO", "SEM_WORKERS", "AGUARDANDO", "OCIOSA"])
  .describe(
    "Estado observado no Redis. Não comprova saúde nem progresso dos workers.",
  );

export const FilaStatusResponseSchema = z.object({
  fila: FilaStatusNomeSchema,
  estado: FilaEstadoOperacionalSchema,
  pausada: z.boolean(),
  workersAtivos: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Workers conectados ao Redis; não necessariamente executando um job.",
    ),
  concorrenciaGlobal: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe(
      "Limite global lido do Redis. Null indica ausência desse limite, não a concorrência local dos workers.",
    ),
  contadores: FilaContadoresSchema.describe(
    "Jobs atualmente retidos no Redis, não totais históricos de execução.",
  ),
  consultadoEm: z.iso
    .datetime()
    .describe(
      "Instante de conclusão da leitura. Os contadores e workers podem mudar durante a consulta.",
    ),
});

export const FilasStatusResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  filas: z.array(FilaStatusResponseSchema),
});

export type FilaStatusNome = z.infer<typeof FilaStatusNomeSchema>;
export type FilaEstadoOperacional = z.infer<typeof FilaEstadoOperacionalSchema>;
export type FilaStatusResponse = z.infer<typeof FilaStatusResponseSchema>;
export type FilasStatusResponse = z.infer<typeof FilasStatusResponseSchema>;
