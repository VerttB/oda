export const QUEUE_NAMES = {
  DGP_SCRAPER: 'oda-dgp-scraper',
  LATTES_SCRAPER: 'oda-lattes-scraper',
  DGP_DISCOVERY: 'oda-dgp-discovery',
  ETL_GROUPS: 'oda-etl-grupos',
  ETL_RESEARCHERS: 'oda-etl-pesquisadores',
  ETL_DISPATCH: 'oda-etl-despacho',
  ETL_PIPELINE: 'oda-etl-pipeline',
  DEMO: 'oda-queue-demo',
} as const;

export const JOB_NAMES = {
  SCRAPE_DGP_GROUP: 'scrape-dgp-group',
  SCRAPE_LATTES_RESEARCHER: 'scrape-lattes-researcher',
  DISCOVER_DGP_GROUPS: 'discover-dgp-groups',
  ETL_GROUP: 'etl-group',
  ETL_RESEARCHER: 'etl-researcher',
  ETL_DISPATCH: 'etl-dispatch',
} as const;

type QueueJobManifest = {
  version: 1;
  requestedAt: string;
  pipelineLogId: string;
  pipelineItemId: string;
};

export const DATA_SCOPES = ['default', 'simcc'] as const;
export type DataScope = typeof DATA_SCOPES[number];

export function normalizeDataScope(scope?: DataScope): DataScope {
  return scope ?? 'default';
}

export function parseDataScope(value: string | undefined): DataScope {
  if (!value || !DATA_SCOPES.includes(value as DataScope)) {
    throw new Error('Use --scope default ou --scope simcc.');
  }
  return value as DataScope;
}

function validateDataScope(scope: unknown) {
  if (scope !== undefined && !DATA_SCOPES.includes(scope as DataScope)) {
    throw new Error('O escopo do job deve ser default ou simcc.');
  }
}

export type ScrapeDgpGroupJob = QueueJobManifest & {
  dgpId: string;
  scope?: DataScope;
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

function validateManifest(value: Partial<QueueJobManifest> | null) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!value || value.version !== 1 || !uuid.test(value.pipelineLogId || '') || !uuid.test(value.pipelineItemId || '')
    || typeof value.requestedAt !== 'string' || !Number.isFinite(Date.parse(value.requestedAt))) {
    throw new Error('Job invalido: versao, data ou identificadores do pipeline ausentes.');
  }
}

export function validateScrapeDgpGroupJob(data: unknown): asserts data is ScrapeDgpGroupJob {
  const value = data as Partial<ScrapeDgpGroupJob> | null;
  if (!value || typeof value.dgpId !== 'string' || !/^\d{16}$/.test(value.dgpId)) {
    throw new Error('O dgpId do job deve conter exatamente 16 digitos.');
  }
  validateDataScope(value.scope);
  validateManifest(value);
}

export type ScrapeLattesResearcherJob = QueueJobManifest & {
  lattesId: string;
  nome: string;
};

export type ScrapeLattesResearcherResult = {
  lattesId: string;
  arquivoJson: string;
  tamanhoTotalBytes: number;
  producoesExtraidas: number;
  imagemBaixada: boolean;
};

export function validateScrapeLattesResearcherJob(data: unknown): asserts data is ScrapeLattesResearcherJob {
  const value = data as Partial<ScrapeLattesResearcherJob> | null;
  if (!value || typeof value.lattesId !== 'string' || !/^\d{16}$/.test(value.lattesId)) {
    throw new Error('O lattesId do job deve conter exatamente 16 digitos.');
  }
  if (typeof value.nome !== 'string' || !value.nome.trim()) throw new Error('O nome do pesquisador e obrigatorio.');
  validateManifest(value);
}

export type DiscoverDgpGroupsJob = QueueJobManifest & {
  chave: string;
};

export type DiscoverDgpGroupsResult = {
  chave: string;
  paginasProcessadas: number;
  itensDescobertos: number;
  itensPulados: number;
  itensComErro: number;
  tamanhoCacheInicial: number;
  tamanhoCacheFinal: number;
};

type EtlFileJobManifest = QueueJobManifest & {
  arquivoJson: string;
  tamanhoBytes: number;
  hashArquivo: string;
};

export type EtlGroupJob = EtlFileJobManifest & {
  dgpId: string;
  scope?: DataScope;
};

export type EtlGroupResult = {
  dgpId: string;
  arquivoJson: string;
  tamanhoBytes: number;
  membrosProcessados: number;
  linhasProcessadas: number;
  arquivoMovido: boolean;
};

export type EtlResearcherJob = EtlFileJobManifest & {
  lattesId: string;
};

export type EtlResearcherResult = {
  lattesId: string;
  arquivoJson: string;
  tamanhoBytes: number;
  artigosProcessados: number;
  livrosCapitulosProcessados: number;
  producoesProcessadas: number;
  lotesProducoes: number;
  arquivoMovido: boolean;
};

export const ETL_DISPATCH_TYPES = ['TODOS', 'GRUPOS', 'PESQUISADORES'] as const;
export type EtlDispatchType = typeof ETL_DISPATCH_TYPES[number];

export type EtlDispatchJob = {
  version: 1;
  requestId: string;
  requestedAt: string;
  tipo: EtlDispatchType;
  ids: string[];
  scope: DataScope;
};

export type EtlDispatchResult = {
  requestId: string;
  pipelineLogId: string | null;
  grupos: number;
  pesquisadores: number;
};

export function validateEtlDispatchJob(data: unknown): asserts data is EtlDispatchJob {
  const value = data as Partial<EtlDispatchJob> | null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!value || value.version !== 1 || !uuid.test(value.requestId || '')
    || typeof value.requestedAt !== 'string' || !Number.isFinite(Date.parse(value.requestedAt))) {
    throw new Error('O pedido de ETL possui identificadores ou data invalidos.');
  }
  if (!ETL_DISPATCH_TYPES.includes(value.tipo as EtlDispatchType)) throw new Error('Tipo de ETL invalido.');
  if (!Array.isArray(value.ids) || value.ids.some(id => !/^\d{16}$/.test(id))) {
    throw new Error('Os IDs do pedido de ETL devem conter exatamente 16 digitos.');
  }
  if (value.tipo === 'TODOS' && value.ids.length) {
    throw new Error('IDs explicitos exigem ETL de GRUPOS ou PESQUISADORES.');
  }
  validateDataScope(value.scope);
  if (value.scope === 'simcc' && value.tipo !== 'GRUPOS') {
    throw new Error('O escopo SIMCC aceita somente ETL de grupos.');
  }
}

function validateEtlFileManifest(value: Partial<EtlFileJobManifest> | null) {
  validateManifest(value);
  if (typeof value?.arquivoJson !== 'string' || !/^[^/\\]+\.json$/i.test(value.arquivoJson)) {
    throw new Error('O job ETL deve informar apenas o nome de um arquivo JSON.');
  }
  if (!Number.isInteger(value.tamanhoBytes) || Number(value.tamanhoBytes) < 0) {
    throw new Error('O tamanho do arquivo ETL deve ser um inteiro nao negativo.');
  }
  if (typeof value.hashArquivo !== 'string' || !/^[0-9a-f]{64}$/i.test(value.hashArquivo)) {
    throw new Error('O hash SHA-256 do arquivo ETL e invalido.');
  }
}

export function validateEtlGroupJob(data: unknown): asserts data is EtlGroupJob {
  const value = data as Partial<EtlGroupJob> | null;
  if (!value || typeof value.dgpId !== 'string' || !/^\d{16}$/.test(value.dgpId)) {
    throw new Error('O dgpId do job ETL deve conter exatamente 16 digitos.');
  }
  validateDataScope(value.scope);
  validateEtlFileManifest(value);
}

export function validateEtlResearcherJob(data: unknown): asserts data is EtlResearcherJob {
  const value = data as Partial<EtlResearcherJob> | null;
  if (!value || typeof value.lattesId !== 'string' || !/^\d{16}$/.test(value.lattesId)) {
    throw new Error('O lattesId do job ETL deve conter exatamente 16 digitos.');
  }
  validateEtlFileManifest(value);
}

export function validateDiscoverDgpGroupsJob(data: unknown): asserts data is DiscoverDgpGroupsJob {
  const value = data as Partial<DiscoverDgpGroupsJob> | null;
  if (!value || typeof value.chave !== 'string' || !value.chave.trim() || value.chave.trim().length > 100) {
    throw new Error('A chave de descoberta deve conter entre 1 e 100 caracteres.');
  }
  validateManifest(value);
}

export const DGP_QUEUE_SETTINGS = {
  concurrency: 1,
  interGroupDelayMs: 15_000,
  attempts: 4,
  retryDelayMs: 60_000,
  reconcileIntervalMs: 30_000,
} as const;

export const LATTES_QUEUE_SETTINGS = {
  concurrency: 1,
  maxJobsPerProcess: 10,
  attempts: 4,
  retryDelayMs: 60_000,
  reconcileIntervalMs: 30_000,
} as const;

export const DISCOVERY_QUEUE_SETTINGS = {
  concurrency: 1,
  attempts: 4,
  retryDelayMs: 60_000,
  reconcileIntervalMs: 30_000,
} as const;

export const ETL_GROUP_QUEUE_SETTINGS = {
  concurrency: 1,
  attempts: 4,
  retryDelayMs: 30_000,
  reconcileIntervalMs: 15_000,
} as const;

export const ETL_RESEARCHER_QUEUE_SETTINGS = {
  concurrency: 1,
  attempts: 4,
  retryDelayMs: 60_000,
  reconcileIntervalMs: 15_000,
} as const;

export const ETL_DISPATCH_QUEUE_SETTINGS = {
  concurrency: 1,
  attempts: 3,
  retryDelayMs: 30_000,
} as const;

export function dgpJobId(dgpId: string) { return `dgp-${dgpId}`; }
export function lattesJobId(lattesId: string) { return `lattes-${lattesId}`; }
export function discoveryJobId(chave: string) {
  return `discovery-${Buffer.from(chave.trim().toLocaleLowerCase('pt-BR')).toString('base64url')}`;
}
export function etlGroupJobId(dgpId: string) { return `etl-grupo-${dgpId}`; }
export function etlResearcherJobId(lattesId: string) { return `etl-pesquisador-${lattesId}`; }
export function etlDispatchJobId(requestId: string) { return `etl-despacho-${requestId}`; }
