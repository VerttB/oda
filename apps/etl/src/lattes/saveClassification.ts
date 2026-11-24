import { createHash } from 'node:crypto';
import type { Prisma } from '@oda/database';
import { keywordSearchKey } from '@oda/shared-types';
import { CLASSIFICATION_VERSION, normalizeDoi, OpenAlexClassification } from './openAlexClassification';

export type OpenAlexEvidence = {
    abstract: string; publicationYear: number | null; issn: string;
    consultadaEm: string;
    classification: OpenAlexClassification;
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    if (value !== null && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])).join(',') + '}';
    }
    return JSON.stringify(value);
}

/** JSONB não preserva a ordem das propriedades dos objetos. */
export function classificationResponseHash(evidence: OpenAlexEvidence): string {
    return hash(canonicalJson(evidence));
}

export function classificationLockKeys(doi: string, evidence: OpenAlexEvidence): string[] {
    return [`class-doi:${normalizeDoi(doi)}`, ...evidence.classification.keywords.map(word => `class-keyword:${word.id}`)];
}

export async function saveClassification(tx: Prisma.TransactionClient, producaoId: string, doi: string, evidence: OpenAlexEvidence) {
    const keys = classificationLockKeys(doi, evidence);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(k)::text FROM (
        SELECT DISTINCT hashtextextended(value,0) k FROM unnest(${keys}::text[]) value ORDER BY k
    ) locks`;
    const hashEntrada = hash(normalizeDoi(doi));
    const hashResposta = classificationResponseHash(evidence);
    const execucao = await tx.execucaoEnriquecimentoProducao.upsert({
        where: { producaoId_hashEntrada_hashResposta_versaoMetodo: { producaoId, hashEntrada, hashResposta, versaoMetodo: CLASSIFICATION_VERSION } },
        create: { producaoId, hashEntrada, hashResposta, versaoMetodo: CLASSIFICATION_VERSION,
            obraExternalId: evidence.classification.obraId, consultadaEm: new Date(evidence.consultadaEm),
            evidencia: evidence as unknown as Prisma.InputJsonValue },
        update: {},
    });
    const common = { execucaoId: execucao.id, versaoMetodo: CLASSIFICATION_VERSION };
    const wordIds: string[] = [];
    for (const word of evidence.classification.keywords) {
        const saved = await tx.palavraChave.upsert({
            where: { origem_externalId: { origem: 'OPENALEX', externalId: word.id } },
            create: { origem: 'OPENALEX', externalId: word.id, chaveIdentidade: word.id,
                termo: word.nome, termoOriginal: word.nome, termoNormalizado: keywordSearchKey(word.nome), traducaoStatus: 'PENDENTE' },
            // Traduções revisadas e o rótulo preferido são preservados.
            update: {},
        });
        wordIds.push(saved.id);
        const relation = { ...common, hashEntrada, avaliadaEm: execucao.avaliadaEm, scoreOriginal: word.score, metodoAssociacao: 'CONSULTA_OBRA' as const };
        await tx.producaoPalavraChave.createMany({ data: [{ producaoId, palavraChaveId: saved.id, ...relation }], skipDuplicates: true });
        await tx.producaoPalavraChave.updateMany({
            where: { producaoId, palavraChaveId: saved.id, revisao: 'PENDENTE', metodoAssociacao: 'CONSULTA_OBRA' }, data: relation,
        });
    }
    await tx.producaoPalavraChave.deleteMany({ where: { producaoId, revisao: 'PENDENTE', metodoAssociacao: 'CONSULTA_OBRA',
        palavraChave: { origem: 'OPENALEX' }, palavraChaveId: { notIn: wordIds } } });

    const topicIds = evidence.classification.topics.map(topic => topic.id.replace('https://openalex.org/', ''));
    const areas = await tx.openAlexAreaConhecimento.findMany({ where: { tipo: 'TOPIC', externalId: { in: topicIds } }, select: { id: true, externalId: true } });
    const unknown = topicIds.filter(id => !areas.some(area => area.externalId === id));
    if (unknown.length) console.warn('[ETL OpenAlex] Tópicos ausentes do catálogo; evidência preservada.', { producaoId, ids: unknown });
    for (const area of areas) {
        const topic = evidence.classification.topics.find(t => t.id.endsWith('/' + area.externalId))!;
        const relation = { ...common, scoreOriginal: topic.score, principal: topic.principal };
        await tx.producaoOpenAlexArea.createMany({ data: [{ producaoId, openAlexAreaId: area.id, ...relation }], skipDuplicates: true });
        await tx.producaoOpenAlexArea.updateMany({ where: { producaoId, openAlexAreaId: area.id, revisao: 'PENDENTE' }, data: relation });
    }
    await tx.producaoOpenAlexArea.deleteMany({ where: { producaoId, revisao: 'PENDENTE', openAlexAreaId: { notIn: areas.map(a => a.id) } } });
    // Uma rejeição humana do tópico também impede novas inferências CNPq por ele.
    const eligibleTopics = await tx.producaoOpenAlexArea.findMany({ where: {
        producaoId, openAlexAreaId: { in: areas.map(a => a.id) }, revisao: { not: 'REJEITADO' },
    }, select: { openAlexAreaId: true } });
    // Só correspondências diretas cuja direção permite generalizar o tópico para a área CNPq.
    const mappings = await tx.mapeamentoAreaTaxonomia.findMany({ where: {
        openAlexAreaId: { in: eligibleTopics.map(a => a.openAlexAreaId) }, status: 'APROVADO',
        tipoRelacao: { in: ['EQUIVALENTE', 'OPENALEX_MAIS_ESPECIFICO'] },
    }, orderBy: { id: 'asc' } });
    for (const mapping of mappings) {
        const relation = { execucaoId: execucao.id, mapeamentoId: mapping.id, metodo: 'MAPEAMENTO_APROVADO' as const };
        await tx.producaoAreaConhecimento.createMany({ data: [{ producaoId, areaConhecimentoId: mapping.areaConhecimentoId, ...relation }], skipDuplicates: true });
        await tx.producaoAreaConhecimento.updateMany({ where: { producaoId, areaConhecimentoId: mapping.areaConhecimentoId,
            metodo: 'MAPEAMENTO_APROVADO', revisao: 'PENDENTE' }, data: relation });
    }
    await tx.producaoAreaConhecimento.deleteMany({ where: { producaoId, revisao: 'PENDENTE', metodo: 'MAPEAMENTO_APROVADO',
        areaConhecimentoId: { notIn: mappings.map(m => m.areaConhecimentoId) } } });
}
