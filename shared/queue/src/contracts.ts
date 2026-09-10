export const QUEUE_NAMES = {
  DGP_SCRAPER: 'oda-dgp-scraper',
  DEMO: 'oda-queue-demo',
} as const;

export const JOB_NAMES = {
  SCRAPE_DGP_GROUP: 'scrape-dgp-group',
} as const;

export type ScrapeDgpGroupJob = {
  version: 1;
  dgpId: string;
  requestedAt: string;
  pipelineLogId: string;
  pipelineItemId: string;
};

export type ScrapeDgpGroupResult = {
  dgpId: string;
  arquivoJson: string;
  tamanhoTotalBytes: number;
  membrosExtraidos: number;
  linhasExtraidas: number;
  instituicoesExtraidas: number;
  pesquisadoresEnfileirados: number;
};

export function validateScrapeDgpGroupJob(data: unknown): asserts data is ScrapeDgpGroupJob {
  const value = data as Partial<ScrapeDgpGroupJob> | null;
  if (!value || typeof value.dgpId !== 'string' || !/^\d{16}$/.test(value.dgpId)) {
    throw new Error('O dgpId do job deve conter exatamente 16 digitos.');
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (value.version !== 1 || !uuid.test(value.pipelineLogId || '') || !uuid.test(value.pipelineItemId || '')
    || typeof value.requestedAt !== 'string' || !Number.isFinite(Date.parse(value.requestedAt))) {
    throw new Error('Job DGP invalido: versao, data ou identificadores do pipeline ausentes.');
  }
}

export const DGP_QUEUE_SETTINGS = {
  concurrency: 1,
  attempts: 4,
  retryDelayMs: 60_000,
  reconcileIntervalMs: 30_000,
} as const;

export function dgpJobId(dgpId: string) { return `dgp-${dgpId}`; }
