import { randomUUID } from 'node:crypto';
import {
    ModuloSistema, ModoExecucao, PipelineEtapa, Prisma, PrismaClient,
    StatusItemLog, StatusSessao, TipoEntidadeLog, TipoErroColeta,
} from '@oda/database';
import {
    DiscoverDgpGroupsJob, DiscoverDgpGroupsResult, QUEUE_NAMES,
    validateDiscoverDgpGroupsJob,
} from '@oda/queue';

export type DiscoveryBatch = { id: string; jobs: DiscoverDgpGroupsJob[]; published: boolean };
type BatchMetadata = {
    queue: string;
    jobs: DiscoverDgpGroupsJob[];
    published: boolean;
    resultados: Record<string, DiscoverDgpGroupsResult>;
    [key: string]: unknown;
};

function metadata(value: Prisma.JsonValue): BatchMetadata {
    const data = value as unknown as BatchMetadata;
    if (!data || data.queue !== QUEUE_NAMES.DGP_DISCOVERY || !Array.isArray(data.jobs)) {
        throw new Error('Pipeline nao pertence a fila BullMQ de descoberta DGP.');
    }
    data.jobs.forEach(validateDiscoverDgpGroupsJob);
    return data;
}

export class DiscoveryQueueRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createBatch(keys: string[]): Promise<DiscoveryBatch> {
        const id = randomUUID();
        const uniqueKeys = [...new Map(keys.map(key => [key.trim().toLocaleLowerCase('pt-BR'), key.trim()])).values()];
        const jobs = uniqueKeys.map(chave => ({
            version: 1 as const,
            chave,
            requestedAt: new Date().toISOString(),
            pipelineLogId: id,
            pipelineItemId: randomUUID(),
        }));
        jobs.forEach(validateDiscoverDgpGroupsJob);
        await this.prisma.pipelineLog.create({
            data: {
                id,
                modulo: ModuloSistema.SCRAPER,
                modoExecucao: ModoExecucao.APENAS_DGP,
                metadata: {
                    queue: QUEUE_NAMES.DGP_DISCOVERY,
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
                    metadata: { path: ['queue'], equals: QUEUE_NAMES.DGP_DISCOVERY },
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

    result(data: DiscoverDgpGroupsJob) {
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
        const itemIds = meta.jobs.map(job => job.pipelineItemId);
        const items = await tx.pipelineLogItem.findMany({ where: { id: { in: itemIds } } });
        const successes = items.filter(item => item.status === StatusItemLog.SUCESSO).length;
        const errors = items.filter(item => item.status === StatusItemLog.ERRO).length;
        const finished = meta.published && successes + errors === meta.jobs.length;
        const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id } });
        const now = new Date();
        const results = Object.values(meta.resultados);
        const sum = (key: keyof DiscoverDgpGroupsResult) => results.reduce((total, value) => total + Number(value[key] || 0), 0);
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
                    chavesProcessadas: successes,
                    chavesComErro: errors,
                    chavesPendentes: meta.jobs.length - successes - errors,
                    paginasProcessadas: sum('paginasProcessadas'),
                    itensDescobertos: sum('itensDescobertos'),
                    itensPulados: sum('itensPulados'),
                    itensComErro: sum('itensComErro'),
                } as unknown as Prisma.InputJsonValue,
            },
        });
    }

    async seal(batch: DiscoveryBatch, accepted: DiscoverDgpGroupsJob[]) {
        await this.locked(batch.id, async (tx, meta) => {
            if (!meta.published) {
                meta.itensDuplicados = meta.jobs.length - accepted.length;
                meta.jobs = accepted;
                meta.published = true;
            }
            await this.refresh(tx, batch.id, meta);
        });
    }

    async begin(data: DiscoverDgpGroupsJob): Promise<DiscoverDgpGroupsResult | null> {
        return this.locked(data.pipelineLogId, async (tx, meta) => {
            if (!meta.jobs.some(job => job.pipelineItemId === data.pipelineItemId && job.chave === data.chave)) {
                throw new Error('Job nao consta no lote de descoberta informado.');
            }
            const item = await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } });
            if (item?.status === StatusItemLog.SUCESSO) return meta.resultados[data.pipelineItemId];
            if (item) throw new Error('Job ja possui resultado definitivo. Publique uma nova execucao.');
            return null;
        });
    }

    async settle(data: DiscoverDgpGroupsJob, result: DiscoverDgpGroupsResult | null, error?: string, attempts = 0) {
        await this.locked(data.pipelineLogId, async (tx, meta) => {
            if (await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } })) return;
            await tx.pipelineLogItem.create({
                data: {
                    id: data.pipelineItemId,
                    pipelineLogId: data.pipelineLogId,
                    entidadeId: data.chave,
                    tipoEntidade: TipoEntidadeLog.GERAL,
                    etapa: PipelineEtapa.DGP_DISCOVERY,
                    status: result ? StatusItemLog.SUCESSO : StatusItemLog.ERRO,
                    tipoErro: result ? null : TipoErroColeta.DESCONHECIDO,
                    mensagemErro: result ? null : error || 'Job interrompido.',
                    detalhesErro: result ? null : JSON.stringify({ attempts, chave: data.chave }),
                },
            });
            if (result) meta.resultados[data.pipelineItemId] = result;
            await this.refresh(tx, data.pipelineLogId, meta);
        });
    }
}
