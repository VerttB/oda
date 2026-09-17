import { randomUUID } from 'node:crypto';
import {
    ModuloSistema, ModoExecucao, PipelineEtapa, Prisma, PrismaClient,
    StatusItemLog, StatusSessao, TipoEntidadeLog, TipoErroColeta,
} from '@oda/database';
import {
    DataScope, EtlGroupJob, EtlGroupResult, EtlResearcherJob, EtlResearcherResult,
    QUEUE_NAMES, validateEtlGroupJob, validateEtlResearcherJob,
} from '@oda/queue';

export type EtlFileDescriptor = {
    id: string;
    arquivoJson: string;
    tamanhoBytes: number;
    hashArquivo: string;
    scope: DataScope;
};

export type EtlBatch = {
    id: string;
    groupJobs: EtlGroupJob[];
    researcherJobs: EtlResearcherJob[];
    groupsPublished: boolean;
    researchersPublished: boolean;
};

type EtlResult = EtlGroupResult | EtlResearcherResult;
type EtlJob = EtlGroupJob | EtlResearcherJob;
type BatchMetadata = {
    queue: string;
    groupJobs: EtlGroupJob[];
    researcherJobs: EtlResearcherJob[];
    groupsPublished: boolean;
    researchersPublished: boolean;
    resultados: Record<string, EtlResult>;
    [key: string]: unknown;
};

function parseMetadata(value: Prisma.JsonValue): BatchMetadata {
    const data = value as unknown as BatchMetadata;
    if (!data || data.queue !== QUEUE_NAMES.ETL_PIPELINE
        || !Array.isArray(data.groupJobs) || !Array.isArray(data.researcherJobs)) {
        throw new Error('Pipeline nao pertence as filas BullMQ do ETL.');
    }
    data.groupJobs.forEach(validateEtlGroupJob);
    data.researcherJobs.forEach(validateEtlResearcherJob);
    if (!data.resultados || typeof data.resultados !== 'object') data.resultados = {};
    return data;
}

function toBatch(id: string, data: BatchMetadata): EtlBatch {
    return {
        id,
        groupJobs: data.groupJobs,
        researcherJobs: data.researcherJobs,
        groupsPublished: data.groupsPublished,
        researchersPublished: data.researchersPublished,
    };
}

function isGroupJob(job: EtlJob): job is EtlGroupJob {
    return 'dgpId' in job;
}

function sameJob(left: EtlJob, right: EtlJob) {
    if (left.pipelineItemId !== right.pipelineItemId) return false;
    if (isGroupJob(left) && isGroupJob(right)) return left.dgpId === right.dgpId;
    if (!isGroupJob(left) && !isGroupJob(right)) return left.lattesId === right.lattesId;
    return false;
}

export class EtlQueueRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createBatch(groups: EtlFileDescriptor[], researchers: EtlFileDescriptor[]): Promise<EtlBatch> {
        const id = randomUUID();
        const requestedAt = new Date().toISOString();
        const groupJobs = groups.map(file => ({
            version: 1 as const, dgpId: file.id, requestedAt, pipelineLogId: id,
            pipelineItemId: randomUUID(), arquivoJson: file.arquivoJson, scope: file.scope,
            tamanhoBytes: file.tamanhoBytes, hashArquivo: file.hashArquivo,
        }));
        const researcherJobs = researchers.map(file => ({
            version: 1 as const, lattesId: file.id, requestedAt, pipelineLogId: id,
            pipelineItemId: randomUUID(), arquivoJson: file.arquivoJson,
            tamanhoBytes: file.tamanhoBytes, hashArquivo: file.hashArquivo,
        }));
        groupJobs.forEach(validateEtlGroupJob);
        researcherJobs.forEach(validateEtlResearcherJob);
        if (!groupJobs.length && !researcherJobs.length) throw new Error('Nenhum arquivo ETL foi selecionado.');

        const modoExecucao = groupJobs.length && researcherJobs.length
            ? ModoExecucao.COMPLETA
            : groupJobs.length ? ModoExecucao.APENAS_DGP : ModoExecucao.APENAS_LATTES;
        const metadata: BatchMetadata = {
            queue: QUEUE_NAMES.ETL_PIPELINE,
            groupJobs,
            researcherJobs,
            groupsPublished: false,
            researchersPublished: false,
            resultados: {},
            scope: groupJobs[0]?.scope ?? 'default',
            itensFila: groupJobs.length + researcherJobs.length,
        };
        await this.prisma.pipelineLog.create({ data: {
            id, modulo: ModuloSistema.ETL, modoExecucao,
            metadata: metadata as unknown as Prisma.InputJsonValue,
        } });
        return toBatch(id, metadata);
    }

    async *openBatches() {
        let cursor: string | undefined;
        for (;;) {
            const rows = await this.prisma.pipelineLog.findMany({
                where: {
                    status: StatusSessao.EMANDAMENTO,
                    metadata: { path: ['queue'], equals: QUEUE_NAMES.ETL_PIPELINE },
                },
                orderBy: { id: 'asc' }, take: 50,
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            });
            if (!rows.length) return;
            for (const row of rows) yield toBatch(row.id, parseMetadata(row.metadata!));
            cursor = rows[rows.length - 1].id;
        }
    }

    async getOpenBatch(id: string): Promise<EtlBatch | null> {
        const row = await this.prisma.pipelineLog.findUnique({ where: { id } });
        if (!row || row.status !== StatusSessao.EMANDAMENTO) return null;
        return toBatch(row.id, parseMetadata(row.metadata!));
    }

    async result(data: EtlJob): Promise<{ status: StatusItemLog } | null> {
        return this.prisma.pipelineLogItem.findUnique({
            where: { id: data.pipelineItemId },
            select: { status: true },
        });
    }

    async groupsFinished(batch: EtlBatch) {
        if (!batch.groupsPublished) return false;
        const ids = batch.groupJobs.map(job => job.pipelineItemId);
        if (!ids.length) return true;
        return await this.prisma.pipelineLogItem.count({ where: { id: { in: ids } } }) === ids.length;
    }

    private locked<T>(id: string, callback: (tx: Prisma.TransactionClient, meta: BatchMetadata) => Promise<T>) {
        return this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM pipeline_log WHERE id = ${id} FOR UPDATE`;
            const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id } });
            return callback(tx, parseMetadata(row.metadata!));
        }, { maxWait: 15000, timeout: 15000 });
    }

    private async refresh(tx: Prisma.TransactionClient, id: string, meta: BatchMetadata) {
        const allJobs = [...meta.groupJobs, ...meta.researcherJobs];
        const itemIds = allJobs.map(job => job.pipelineItemId);
        const items = itemIds.length
            ? await tx.pipelineLogItem.findMany({ where: { id: { in: itemIds } } })
            : [];
        const successes = items.filter(item => item.status === StatusItemLog.SUCESSO).length;
        const errors = items.filter(item => item.status === StatusItemLog.ERRO).length;
        const groupsDone = meta.groupsPublished
            && meta.groupJobs.every(job => items.some(item => item.id === job.pipelineItemId));
        const researchersDone = meta.researchersPublished
            && meta.researcherJobs.every(job => items.some(item => item.id === job.pipelineItemId));
        const finished = groupsDone && researchersDone;
        const row = await tx.pipelineLog.findUniqueOrThrow({ where: { id } });
        const now = new Date();
        const results = Object.values(meta.resultados);
        const sum = (key: string) => results.reduce((total, value) => total + Number((value as unknown as Record<string, unknown>)[key] || 0), 0);
        await tx.pipelineLog.update({ where: { id }, data: {
            registrosProcessados: successes + errors,
            quantidadeSucessos: successes,
            quantidadeErros: errors,
            status: finished ? (errors ? StatusSessao.ERRO : StatusSessao.CONCLUIDO) : StatusSessao.EMANDAMENTO,
            dataFim: finished ? now : null,
            duracaoMs: finished ? Math.min(now.getTime() - row.dataInicio.getTime(), 2_147_483_647) : null,
            metadata: {
                ...meta,
                itensFila: allJobs.length,
                itensPendentes: allJobs.length - successes - errors,
                gruposGravados: meta.groupJobs.filter(job => meta.resultados[job.pipelineItemId]).length,
                pesquisadoresAtualizados: meta.researcherJobs.filter(job => meta.resultados[job.pipelineItemId]).length,
                linhasPesquisaGravadas: sum('linhasProcessadas'),
                producoesVinculadas: sum('producoesProcessadas'),
                tamanhoTotalBytes: sum('tamanhoBytes'),
            } as unknown as Prisma.InputJsonValue,
        } });
    }

    async sealGroups(batch: EtlBatch, accepted: EtlGroupJob[]) {
        await this.locked(batch.id, async (tx, meta) => {
            if (!meta.groupsPublished) {
                meta.gruposDuplicados = meta.groupJobs.length - accepted.length;
                meta.groupJobs = accepted;
                meta.groupsPublished = true;
            }
            await this.refresh(tx, batch.id, meta);
        });
    }

    async sealResearchers(batch: EtlBatch, accepted: EtlResearcherJob[]) {
        await this.locked(batch.id, async (tx, meta) => {
            if (!meta.researchersPublished) {
                meta.pesquisadoresDuplicados = meta.researcherJobs.length - accepted.length;
                meta.researcherJobs = accepted;
                meta.researchersPublished = true;
            }
            await this.refresh(tx, batch.id, meta);
        });
    }

    async begin(data: EtlJob): Promise<EtlResult | null> {
        return this.locked(data.pipelineLogId, async (tx, meta) => {
            const jobs: EtlJob[] = [...meta.groupJobs, ...meta.researcherJobs];
            const belongs = jobs.some(job => sameJob(job, data));
            if (!belongs) throw new Error('Job ETL nao consta no lote informado.');
            const item = await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } });
            if (item?.status === StatusItemLog.SUCESSO) return meta.resultados[data.pipelineItemId];
            if (item) throw new Error('Job ETL ja possui resultado definitivo. Publique uma nova execucao.');
            return null;
        });
    }

    async settle(data: EtlJob, result: EtlResult | null, error?: string, attempts = 0) {
        await this.locked(data.pipelineLogId, async (tx, meta) => {
            if (await tx.pipelineLogItem.findUnique({ where: { id: data.pipelineItemId } })) return;
            const group = isGroupJob(data);
            const entityId = group ? data.dgpId : data.lattesId;
            await tx.pipelineLogItem.create({ data: {
                id: data.pipelineItemId,
                pipelineLogId: data.pipelineLogId,
                entidadeId: entityId,
                tipoEntidade: group ? TipoEntidadeLog.GRUPO : TipoEntidadeLog.PESQUISADOR,
                etapa: group ? PipelineEtapa.ETL_GRUPO_CARGA : PipelineEtapa.ETL_PESQUISADOR_CARGA,
                status: result ? StatusItemLog.SUCESSO : StatusItemLog.ERRO,
                tipoErro: result ? null : TipoErroColeta.FALHA_ETL,
                mensagemErro: result ? null : error || 'Job ETL interrompido.',
                detalhesErro: result ? null : JSON.stringify({ attempts, arquivoJson: data.arquivoJson }),
            } });
            if (result) meta.resultados[data.pipelineItemId] = result;
            await this.refresh(tx, data.pipelineLogId, meta);
        });
    }
}
