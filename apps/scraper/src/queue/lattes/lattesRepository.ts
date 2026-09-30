import { randomUUID } from 'node:crypto';
import {
    FilaExtracaoStatus, ModuloSistema, ModoExecucao, PipelineEtapa, Prisma,
    PrismaClient, StatusItemLog, StatusSessao, TipoEntidadeLog, TipoErroColeta,
} from '@oda/database';
import {
    QUEUE_NAMES, ScrapeLattesResearcherJob, ScrapeLattesResearcherResult,
    validateScrapeLattesResearcherJob,
} from '@oda/queue';

export type LattesTarget = { lattesId: string; nome: string };
export type LattesBatch = { id: string; jobs: ScrapeLattesResearcherJob[]; published: boolean };
type BatchMetadata = {
    queue: string;
    jobs: ScrapeLattesResearcherJob[];
    published: boolean;
    resultados: Record<string, ScrapeLattesResearcherResult>;
    [key: string]: unknown;
};

function metadata(value: Prisma.JsonValue): BatchMetadata {
    const data = value as unknown as BatchMetadata;
    if (!data || data.queue !== QUEUE_NAMES.LATTES_SCRAPER || !Array.isArray(data.jobs)) {
        throw new Error('Pipeline nao pertence a fila BullMQ Lattes.');
    }
    data.jobs.forEach(validateScrapeLattesResearcherJob);
    return data;
}

export class LattesQueueRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createBatch(targets: LattesTarget[]): Promise<LattesBatch> {
        const activeSince = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const legacyPipeline = await this.prisma.pipelineLog.findFirst({
            where: {
                modulo: ModuloSistema.SCRAPER,
                modoExecucao: ModoExecucao.APENAS_LATTES,
                status: StatusSessao.EMANDAMENTO,
                atualizadoEm: { gte: activeSince },
                metadata: { path: ['comando'], equals: 'lattes-scraper' },
            },
            select: { id: true },
        });
        if (legacyPipeline) {
            throw new Error('O scraper Lattes tradicional esta em andamento. Aguarde sua conclusao antes de publicar jobs BullMQ.');
        }
        const id = randomUUID();
        const unique = [...new Map(targets.map(target => [target.lattesId, target])).values()];
        const jobs = unique.map(target => ({
            version: 1 as const,
            ...target,
            requestedAt: new Date().toISOString(),
            pipelineLogId: id,
            pipelineItemId: randomUUID(),
        }));
        jobs.forEach(validateScrapeLattesResearcherJob);
        await this.prisma.pipelineLog.create({
            data: {
                id,
                modulo: ModuloSistema.SCRAPER,
                modoExecucao: ModoExecucao.APENAS_LATTES,
                metadata: {
                    queue: QUEUE_NAMES.LATTES_SCRAPER,
                    jobs,
                    published: false,
                    resultados: {},
                    itensFila: jobs.length,
                },
            },
        });
        return { id, jobs, published: false };
    }

    async *openBatches() {
        let cursor: string | undefined;
        for (;;) {
            const rows = await this.prisma.pipelineLog.findMany({
                where: {
                    status: StatusSessao.EMANDAMENTO,
                    metadata: { path: ['queue'], equals: QUEUE_NAMES.LATTES_SCRAPER },
                },
                orderBy: { id: 'asc' },
                take: 50,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            });
            if (!rows.length) return;
            for (const row of rows) {
                const data = metadata(row.metadata!);
                yield { id: row.id, jobs: data.jobs, published: data.published };
            }
            cursor = rows[rows.length - 1].id;
        }
    }

    result(data: ScrapeLattesResearcherJob) {
        return this.prisma.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } });
    }

    private locked<T>(id: string, callback: (tx: Prisma.TransactionClient, meta: BatchMetadata) => Promise<T>) {
        return this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM pipeline_log WHERE id = ${id} FOR UPDATE`;
            const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id } });
            return callback(tx, metadata(row.metadata!));
        }, { maxWait: 15000, timeout: 15000 });
    }

    private async refresh(tx: Prisma.TransactionClient, id: string, meta: BatchMetadata) {
        const jobItemIds = meta.jobs.map(job => job.pipelineItemId);
        const items = await tx.pipelineLogItem.findMany({ where: { id: { in: jobItemIds } } });
        const successes = items.filter(item => item.status === StatusItemLog.SUCESSO).length;
        const errors = items.filter(item => item.status === StatusItemLog.ERRO).length;
        const finished = meta.published && successes + errors === meta.jobs.length;
        const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id } });
        const now = new Date();
        const results = Object.values(meta.resultados);
        const tamanhoTotalBytes = results.reduce((total, value) => total + Number(value.tamanhoTotalBytes || 0), 0);
        const producoesExtraidas = results.reduce((total, value) => total + Number(value.producoesExtraidas || 0), 0);
        await tx.pipelineLog.update({
            where: { id },
            data: {
                registrosProcessados: successes + errors,
                quantidadeSucessos: successes,
                quantidadeErros: errors,
                status: finished ? (errors ? StatusSessao.ERRO : StatusSessao.CONCLUIDO) : StatusSessao.EMANDAMENTO,
                dataFim: finished ? now : null,
                duracaoMs: finished ? Math.min(now.getTime() - row.dataInicio.getTime(), 2147483647) : null,
                metadata: {
                    ...meta,
                    itensFila: meta.jobs.length,
                    pesquisadoresExtraidos: successes,
                    pesquisadoresComErro: errors,
                    pesquisadoresPendentes: meta.jobs.length - successes - errors,
                    arquivosJsonGerados: successes,
                    tamanhoTotalBytes,
                    producoesExtraidas,
                } as unknown as Prisma.InputJsonValue,
            },
        });
    }

    async seal(batch: LattesBatch, accepted: ScrapeLattesResearcherJob[]) {
        await this.locked(batch.id, async (tx, meta) => {
            if (!meta.published) {
                meta.itensDuplicados = meta.jobs.length - accepted.length;
                meta.jobs = accepted;
                meta.published = true;
            }
            await this.refresh(tx, batch.id, meta);
        });
    }

    async begin(data: ScrapeLattesResearcherJob): Promise<ScrapeLattesResearcherResult | null> {
        return this.locked(data.pipelineLogId, async (tx, meta) => {
            if (!meta.jobs.some(job => job.pipelineItemId === data.pipelineItemId && job.lattesId === data.lattesId)) {
                throw new Error('Job nao consta no lote Lattes informado.');
            }
            const item = await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } });
            if (item?.status === StatusItemLog.SUCESSO) return meta.resultados[data.pipelineItemId];
            if (item) throw new Error('Job ja possui resultado definitivo. Publique uma nova execucao.');
            const row = await tx.filaExtracaoPesquisador.findUniqueOrThrow({ where: { lattesId: data.lattesId } });
            await tx.filaExtracaoPesquisador.update({
                where: { lattesId: data.lattesId },
                data: {
                    status: FilaExtracaoStatus.PROCESSANDO,
                    processamentoIniciadoEm: row.processamentoIniciadoEm || new Date(),
                    tentativas: { increment: 1 },
                    ultimoErroId: null,
                    ultimoErroEm: null,
                },
            });
            return null;
        });
    }

    async settle(
        data: ScrapeLattesResearcherJob,
        result: ScrapeLattesResearcherResult | null,
        error?: string,
        attempts = 0,
        tipoErro: TipoErroColeta = TipoErroColeta.DESCONHECIDO,
    ) {
        await this.locked(data.pipelineLogId, async (tx, meta) => {
            if (await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } })) return;
            const row = await tx.filaExtracaoPesquisador.findUniqueOrThrow({ where: { lattesId: data.lattesId } });
            const now = new Date();
            await tx.pipelineLogItem.create({
                data: {
                    id: data.pipelineItemId,
                    pipelineLogId: data.pipelineLogId,
                    entidadeId: data.lattesId,
                    tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                    etapa: PipelineEtapa.PESQUISADOR_LATTES,
                    status: result ? StatusItemLog.SUCESSO : StatusItemLog.ERRO,
                    tipoErro: result ? null : tipoErro,
                    mensagemErro: result ? null : error || 'Job interrompido.',
                    detalhesErro: result ? null : JSON.stringify({ attempts, jobId: `lattes-${data.lattesId}` }),
                    tempoMs: Math.min(now.getTime() - (row.processamentoIniciadoEm?.getTime() || now.getTime()), 2147483647),
                },
            });
            await tx.filaExtracaoPesquisador.update({
                where: { lattesId: data.lattesId },
                data: {
                    status: result ? FilaExtracaoStatus.CONCLUIDO : FilaExtracaoStatus.ERRO,
                    processamentoIniciadoEm: null,
                    ultimoErroId: result ? null : data.pipelineItemId,
                    ultimoErroEm: result ? null : now,
                },
            });
            if (result) meta.resultados[data.pipelineItemId] = result;
            await this.refresh(tx, data.pipelineLogId, meta);
        });
    }
}
