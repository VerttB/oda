import { AiQueueJobSchema, AiQueueResultSchema } from '@oda/shared-types';
import type { AiQueueResult } from '@oda/shared-types';
import { AI_JOB_NAMES, UnrecoverableError } from '@oda/queue';
import type { AiQueueJob } from '@oda/shared-types';

export type AiExecutor = (data: AiQueueJob) => Promise<AiQueueResult>;
type AiJob = {
  id?: string;
  name: string;
  data: unknown;
  updateProgress: (progress: object) => Promise<void>;
};

export function createAiProcessor(execute: AiExecutor) {
  return async (job: AiJob): Promise<AiQueueResult> => {
    const parsed = AiQueueJobSchema.safeParse(job.data);
    if (!parsed.success)
      throw new UnrecoverableError('Contrato do job de IA inválido.');
    const data = parsed.data;
    if (AI_JOB_NAMES[data.operation] !== job.name)
      throw new UnrecoverableError('Operação do job de IA inconsistente.');
    if (Date.now() >= data.expiresAt)
      throw new UnrecoverableError(
        'Solicitação de IA expirada antes do processamento.',
      );
    await job.updateProgress({
      etapa: 'PROCESSANDO',
      requestId: data.requestId,
    });
    const result = AiQueueResultSchema.safeParse(await execute(data));
    if (!result.success || result.data.operation !== data.operation)
      throw new UnrecoverableError('Resultado do job de IA inválido.');
    await job.updateProgress({ etapa: 'CONCLUIDO', requestId: data.requestId });
    return result.data;
  };
}
