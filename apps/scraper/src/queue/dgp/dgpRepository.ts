import { randomUUID } from 'node:crypto';
import {
    FilaExtracaoStatus, ModuloSistema, ModoExecucao, PipelineEtapa, Prisma,
    PrismaClient, StatusItemLog, StatusSessao, TipoEntidadeLog, TipoErroColeta,
} from '@oda/database';
import { DataScope, QUEUE_NAMES, ScrapeDgpGroupJob, ScrapeDgpGroupResult, validateScrapeDgpGroupJob } from '@oda/queue';

export type DgpBatch = { id: string; jobs: ScrapeDgpGroupJob[]; published: boolean };
type BatchMetadata = {
    queue: string;
    jobs: ScrapeDgpGroupJob[];
    published: boolean;
    resultados: Record<string, ScrapeDgpGroupResult>;
    [key: string]: unknown;
};

function metadata(value: Prisma.JsonValue): BatchMetadata {
    const data = value as unknown as BatchMetadata;
    if (!data || data.queue !== QUEUE_NAMES.DGP_SCRAPER || !Array.isArray(data.jobs)) {
        throw new Error('Pipeline nao pertence a fila BullMQ DGP.');
    }
    data.jobs.forEach(validateScrapeDgpGroupJob);
    return data;
}

export class DgpQueueRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createBatch(dgpIds: string[], scope: DataScope = 'default'): Promise<DgpBatch> {
        const id = randomUUID();
        const jobs = [...new Set(dgpIds)].map(dgpId => ({
            version: 1 as const, dgpId, requestedAt: new Date().toISOString(),
            pipelineLogId: id, pipelineItemId: randomUUID(), scope,
        }));
        jobs.forEach(validateScrapeDgpGroupJob);
        await this.prisma.pipelineLog.create({ data: {
            id, modulo: ModuloSistema.SCRAPER, modoExecucao: ModoExecucao.APENAS_DGP,
            dgpId: jobs.length === 1 ? jobs[0].dgpId : null,
            metadata: { queue: QUEUE_NAMES.DGP_SCRAPER, scope, jobs, published: false, resultados: {}, itensFila: jobs.length },
        } });
        return { id, jobs, published: false };
    }

    async *openBatches() {
        let cursor: string | undefined;
        for (;;) {
            const rows = await this.prisma.pipelineLog.findMany({
                where: { status: StatusSessao.EMANDAMENTO, metadata: { path: ['queue'], equals: QUEUE_NAMES.DGP_SCRAPER } },
                orderBy: { id: 'asc' }, take: 50,
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

    async result(data: ScrapeDgpGroupJob) {
        return this.prisma.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } });
    }

    // FOR UPDATE serializa alteracoes nesta sessao ate commit/rollback; a coleta fica fora da transacao.
    private async locked<T>(id: string, callback: (tx: Prisma.TransactionClient, meta: BatchMetadata) => Promise<T>) {
        return this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM pipeline_log WHERE id = ${id} FOR UPDATE`;
            const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id } });
            return callback(tx, metadata(row.metadata!));
        }, { maxWait: 15000, timeout: 15000 });
    }

    private async refresh(tx: Prisma.TransactionClient, id: string, meta: BatchMetadata) {
        const items = await tx.pipelineLogItem.findMany({ where: { pipelineLogId: id } });
        const successes = items.filter(item => item.status === StatusItemLog.SUCESSO).length;
        const errors = items.filter(item => item.status === StatusItemLog.ERRO).length;
        const finished = meta.published && successes + errors === meta.jobs.length;
        const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id } });
        const now = new Date();
        const results = Object.values(meta.resultados);
        const sums = Object.fromEntries(['tamanhoTotalBytes', 'membrosExtraidos', 'linhasExtraidas', 'instituicoesExtraidas', 'pesquisadoresEnfileirados']
            .map(key => [key, results.reduce((total, value) => total + Number(value[key] || 0), 0)]));
        await tx.pipelineLog.update({ where: { id }, data: {
            dgpId: meta.jobs.length === 1 ? meta.jobs[0].dgpId : null,
            registrosProcessados: successes + errors, quantidadeSucessos: successes, quantidadeErros: errors,
            status: finished ? (errors ? StatusSessao.ERRO : StatusSessao.CONCLUIDO) : StatusSessao.EMANDAMENTO,
            dataFim: finished ? now : null,
            duracaoMs: finished ? Math.min(now.getTime() - row.dataInicio.getTime(), 2147483647) : null,
            metadata: { ...meta, ...sums, itensFila: meta.jobs.length, gruposExtraidos: successes, itensComErro: errors,
                arquivosJsonGerados: successes, gruposPendentes: meta.jobs.length - successes - errors } as unknown as Prisma.InputJsonValue,
        } });
    }

    async seal(batch: DgpBatch, accepted: ScrapeDgpGroupJob[]) {
        await this.locked(batch.id, async (tx, meta) => {
            // Outra reconciliacao pode ter terminado a publicacao durante este ciclo.
            if (!meta.published) {
                meta.itensDuplicados = meta.jobs.length - accepted.length;
                meta.jobs = accepted;
                meta.published = true;
            }
            await this.refresh(tx, batch.id, meta);
        });
    }

    async begin(data: ScrapeDgpGroupJob): Promise<ScrapeDgpGroupResult | null> {
        return this.locked(data.pipelineLogId, async (tx, meta) => {
            if (!meta.jobs.some(job => job.pipelineItemId === data.pipelineItemId && job.dgpId === data.dgpId)) {
                throw new Error('Job nao consta no lote informado.');
            }
            const item = await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } });
            if (item?.status === StatusItemLog.SUCESSO) return meta.resultados[data.pipelineItemId];
            if (item) throw new Error('Job ja possui resultado definitivo. Publique uma nova execucao.');
            const row = await tx.filaExtracaoGrupo.findUniqueOrThrow({ where: { dgpId: data.dgpId } });
            await tx.filaExtracaoGrupo.update({ where: { dgpId: data.dgpId }, data: {
                status: FilaExtracaoStatus.PROCESSANDO,
                processamentoIniciadoEm: row.processamentoIniciadoEm || new Date(),
                tentativas: { increment: 1 }, ultimoErroId: null, ultimoErroEm: null,
            } });
            return null;
        });
    }

    async settle(data: ScrapeDgpGroupJob, result: ScrapeDgpGroupResult | null, error?: string, attempts = 0) {
        await this.locked(data.pipelineLogId, async (tx, meta) => {
            const previous = await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } });
            if (previous) return;
            const row = await tx.filaExtracaoGrupo.findUniqueOrThrow({ where: { dgpId: data.dgpId } });
            const now = new Date();
            await tx.pipelineLogItem.create({ data: {
                id: data.pipelineItemId, pipelineLogId: data.pipelineLogId, entidadeId: data.dgpId,
                tipoEntidade: TipoEntidadeLog.GRUPO, etapa: PipelineEtapa.SCRAPE_GROUP_PAGE,
                status: result ? StatusItemLog.SUCESSO : StatusItemLog.ERRO,
                tipoErro: result ? null : TipoErroColeta.DESCONHECIDO,
                mensagemErro: result ? null : error || 'Job interrompido.',
                detalhesErro: result ? null : JSON.stringify({ attempts, jobId: `dgp-${data.dgpId}` }),
                tempoMs: Math.min(now.getTime() - (row.processamentoIniciadoEm?.getTime() || now.getTime()), 2147483647),
            } });
            await tx.filaExtracaoGrupo.update({ where: { dgpId: data.dgpId }, data: {
                status: result ? FilaExtracaoStatus.CONCLUIDO : FilaExtracaoStatus.ERRO,
                processamentoIniciadoEm: null, ultimoErroId: result ? null : data.pipelineItemId,
                ultimoErroEm: result ? null : now,
            } });
            if (result) meta.resultados[data.pipelineItemId] = result;
            await this.refresh(tx, data.pipelineLogId, meta);
        });
    }
}
