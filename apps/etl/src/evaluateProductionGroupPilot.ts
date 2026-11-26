import type { PrismaClient } from '@oda/database';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { evaluatePilotPair } from './production-group/pilotRules';

type Pair = { grupoId: string; producaoId: string; recorte: 'GERAL' | 'COM_CLASSIFICACAO' };
type Manifest = { grupos: { id: string }[]; pares: Pair[] };
type Authorship = { grupoId: string; producaoId: string; pesquisadorId: string; anoEntrada: number | null };
type RagMatch = {
    grupoId: string; producaoId: string; linhaId: string; similaridadeCosseno: number;
    modelo: string; versaoIndice: string;
};

const pairKey = (pair: { grupoId: string; producaoId: string }) => pair.grupoId + ':' + pair.producaoId;
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

function parseManifest(input: string): Manifest {
    const value = JSON.parse(input);
    if (value?.versao !== 1 || value.tipo !== 'AMOSTRA_PARA_REVISAO' ||
        !Array.isArray(value.grupos) || !Array.isArray(value.pares) ||
        value.grupos.length < 1 || value.grupos.length > 24 ||
        value.pares.length < 1 || value.pares.length > 24 * 500 ||
        !value.grupos.every(group => typeof group?.id === 'string' && uuid.test(group.id))) {
        throw new Error('Informe um manifesto válido gerado por prepare:production-group-pilot.');
    }
    const groupIds = new Set(value.grupos.map(group => group.id));
    if (groupIds.size !== value.grupos.length || !value.pares.every(pair =>
        groupIds.has(pair?.grupoId) && typeof pair.producaoId === 'string' && uuid.test(pair.producaoId) &&
        ['GERAL', 'COM_CLASSIFICACAO'].includes(pair.recorte)) ||
        new Set(value.pares.map(pairKey)).size !== value.pares.length ||
        new Set(value.pares.map(pair => pair.producaoId)).size > 500) {
        throw new Error('O manifesto possui pares inválidos ou duplicados.');
    }
    return value;
}

async function evaluate(db: PrismaClient, database: typeof import('@oda/database'), manifest: Manifest) {
    const groupIds = manifest.grupos.map(group => group.id);
    const groupCountByProduction = new Map<string, number>();
    for (const pair of manifest.pares) {
        groupCountByProduction.set(pair.producaoId, (groupCountByProduction.get(pair.producaoId) ?? 0) + 1);
    }
    const productionIds = [...groupCountByProduction.keys()];
    const selectedPairs = database.Prisma.sql`SELECT * FROM unnest(
        ${manifest.pares.map(pair => pair.grupoId)}::text[],
        ${manifest.pares.map(pair => pair.producaoId)}::text[]
    ) AS pair(grupo_id, producao_id)`;
    return db.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const groups = await tx.grupoPesquisa.findMany({
            where: { id: { in: groupIds }, situacao: database.Situacao.CERTIFICADO,
                instituicoes: { some: database.SIMCC_SEDE_WHERE } },
            select: {
                id: true, nome: true, anoFormacao: true, areaConhecimentoId: true,
                linhasPesquisa: { orderBy: { id: 'asc' }, select: {
                    id: true, titulo: true, objetivo: true,
                    palavrasChave: { orderBy: { palavraChaveId: 'asc' }, select: { palavraChave: { select: { termo: true } } } },
                } },
            },
        });
        const productions = await tx.producao.findMany({
            where: { id: { in: productionIds } },
            select: {
                id: true, titulo: true, resumo: true, ano: true, tipo: true, doi: true,
                palavrasChave: { where: { revisao: { not: 'REJEITADO' } }, select: {
                    palavraChave: { select: { termo: true, termoOriginal: true, traducaoStatus: true } },
                } },
                areasConhecimento: { where: { revisao: { not: 'REJEITADO' }, OR: [
                    { metodo: 'REVISAO_MANUAL', revisao: 'CONFIRMADO' },
                    { metodo: 'MAPEAMENTO_APROVADO', mapeamento: {
                        status: 'APROVADO', tipoRelacao: { in: ['EQUIVALENTE', 'OPENALEX_MAIS_ESPECIFICO'] },
                    } },
                ] }, select: { areaConhecimento: { select: { id: true, nome: true } } } },
                areasOpenAlex: { where: { revisao: { not: 'REJEITADO' } }, select: {
                    openAlexArea: { select: { id: true, externalId: true, termo: true } },
                } },
            },
        });
        if (groups.length !== groupIds.length || productions.length !== productionIds.length) {
            throw new Error('Há grupo fora do escopo atual ou produção ausente. Gere um novo manifesto.');
        }
        const authorships = await tx.$queryRaw<Authorship[]>`
            WITH selected AS (${selectedPairs})
            SELECT s.grupo_id AS "grupoId", s.producao_id AS "producaoId", a.pesquisador_id AS "pesquisadorId",
                   extract(year FROM m.data_entrada)::int AS "anoEntrada"
            FROM selected s
            JOIN producao_pesquisador a ON a.producao_id = s.producao_id
            JOIN membro_grupo m ON m.pesquisador_id = a.pesquisador_id AND m.grupo_id = s.grupo_id
            ORDER BY s.grupo_id, s.producao_id, a.pesquisador_id`;
        const authorsByPair = new Map<string, Authorship[]>();
        for (const author of authorships) {
            const key = pairKey(author);
            const current = authorsByPair.get(key) ?? [];
            current.push(author);
            authorsByPair.set(key, current);
        }
        if (authorsByPair.size !== manifest.pares.length) {
            throw new Error('O vínculo de autoria de pelo menos um par mudou. Gere um novo manifesto.');
        }
        const possibleMappings = await tx.mapeamentoAreaTaxonomia.findMany({
            where: {
                openAlexAreaId: { in: productions.flatMap(work => work.areasOpenAlex.map(topic => topic.openAlexArea.id)) },
            },
            orderBy: [{ openAlexAreaId: 'asc' }, { areaConhecimentoId: 'asc' }],
            select: { id: true, status: true, tipoRelacao: true, metodo: true,
                openAlexArea: { select: { externalId: true, termo: true } },
                areaConhecimento: { select: { id: true, nome: true } },
            },
        });
        // Comparação exploratória do acervo RAG. Esses vetores incluem campos de autoria e instituição.
        const rag = await tx.$queryRaw<RagMatch[]>`
            WITH selected AS (${selectedPairs})
            SELECT p.grupo_id AS "grupoId", p.producao_id AS "producaoId", best.*
            FROM selected p
            JOIN LATERAL (
                SELECT l.id AS "linhaId", 1 - (cw.embedding <=> cl.embedding) AS "similaridadeCosseno",
                       wd.metadata #>> '{__ragIndex,embeddingModel}' AS modelo,
                       wd.metadata #>> '{__ragIndex,indexVersion}' AS "versaoIndice"
                FROM producao w
                JOIN rag_document wd ON wd.source_type = 'producao' AND wd.source_id = w.id
                                    AND wd.atualizado_em >= w.atualizado_em
                JOIN rag_chunk cw ON cw.document_id = wd.id AND cw.embedding IS NOT NULL AND vector_norm(cw.embedding) > 0
                JOIN linha_pesquisa l ON l.grupo_id = p.grupo_id
                JOIN rag_document ld ON ld.source_type = 'linha_pesquisa' AND ld.source_id = l.id
                                    AND ld.atualizado_em >= l.atualizado_em
                JOIN rag_chunk cl ON cl.document_id = ld.id AND cl.embedding IS NOT NULL AND vector_norm(cl.embedding) > 0
                WHERE w.id = p.producao_id
                  AND wd.metadata #>> '{__ragIndex,embeddingModel}' = ld.metadata #>> '{__ragIndex,embeddingModel}'
                  AND wd.metadata #>> '{__ragIndex,indexVersion}' = ld.metadata #>> '{__ragIndex,indexVersion}'
                ORDER BY cw.embedding <=> cl.embedding, l.id
                LIMIT 1
            ) best ON true`;

        const byGroup = new Map(groups.map(group => [group.id, {
            ...group,
            linhas: group.linhasPesquisa.map(line => ({
                id: line.id, titulo: line.titulo, objetivo: line.objetivo,
                termos: line.palavrasChave.map(entry => entry.palavraChave.termo),
            })),
        }]));
        const byWork = new Map(productions.map(work => [work.id, {
            id: work.id, titulo: work.titulo, resumo: work.resumo, ano: work.ano, tipo: work.tipo, doi: work.doi,
            palavras: work.palavrasChave.map(({ palavraChave: word }) => ({
                original: word.termoOriginal ?? word.termo,
                rotuloRevisado: word.traducaoStatus === 'REVISADA' ? word.termo : undefined,
            })),
            areas: work.areasConhecimento.map(row => row.areaConhecimento),
            topicos: work.areasOpenAlex.map(row => row.openAlexArea),
        }]));
        const ragByPair = new Map(rag.map(match => [pairKey(match), match]));
        const pairs = manifest.pares.map(pair => {
            const group = byGroup.get(pair.grupoId)!;
            const work = byWork.get(pair.producaoId)!;
            const authors = authorsByPair.get(pairKey(pair))!;
            const comparison = ragByPair.get(pairKey(pair));
            const rules = evaluatePilotPair(work, {
                anoFormacao: group.anoFormacao, areaPrincipalId: group.areaConhecimentoId, linhas: group.linhas,
            }, authors.map(author => author.anoEntrada));
            const totalGruposNaAmostra = groupCountByProduction.get(pair.producaoId)!;
            if (totalGruposNaAmostra > 1) rules.flags.push('CANDIDATA_EM_MULTIPLOS_GRUPOS_DA_AMOSTRA');
            return {
                ...pair, ...rules, totalGruposNaAmostra,
                autoresVinculados: authors.map(author => ({ pesquisadorId: author.pesquisadorId, anoEntrada: author.anoEntrada })),
                comparacaoRag: comparison ? {
                    linhaId: comparison.linhaId, similaridadeCosseno: comparison.similaridadeCosseno,
                    modelo: comparison.modelo, versaoIndice: comparison.versaoIndice,
                } : null,
                revisao: { decisao: 'PENDENTE', revisor: null, justificativa: null },
            };
        });
        const count = (triagem: string) => pairs.filter(pair => pair.triagem === triagem).length;
        return {
            grupos: [...byGroup.values()].map(({ linhasPesquisa, ...group }) => group),
            producoes: [...byWork.values()],
            mapeamentosParaCuradoria: possibleMappings,
            resumo: {
                grupos: byGroup.size, producoesDistintas: byWork.size, pares: pairs.length,
                revisarAfinidade: count('REVISAR_AFINIDADE'), conflitoTemporal: count('CONFLITO_TEMPORAL'),
                evidenciaInsuficiente: count('EVIDENCIA_INSUFICIENTE'), comparacoesRag: rag.length,
                paresComAreaPrincipalEmComum: pairs.filter(pair => pair.areaPrincipalEmComum).length,
                paresEmMultiplosGrupos: pairs.filter(pair => pair.totalGruposNaAmostra > 1).length,
            },
            pares: pairs,
        };
    }, { isolationLevel: 'RepeatableRead', timeout: 60_000 });
}

async function main() {
    const { values } = parseArgs({ options: {
        manifest: { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean' },
    } });
    const usage = 'Defina ODA_PILOT_DATABASE_URL e informe --manifest AMOSTRA.json --output AVALIACAO.json.';
    if (values.help) { console.log(usage); return; }
    const connectionString = process.env.ODA_PILOT_DATABASE_URL;
    if (!values.manifest || !values.output || !connectionString) throw new Error(usage);
    const target = new URL(connectionString);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
        !['postgres:', 'postgresql:'].includes(target.protocol)) throw new Error('Use um PostgreSQL local em loopback.');
    const input = await readFile(values.manifest, 'utf8');
    const manifest = parseManifest(input);
    process.env.DATABASE_URL = connectionString;
    const database = await import('@oda/database');
    const db = new database.PrismaClient(database.prismaConfig);
    try {
        const result = await evaluate(db, database, manifest);
        const output = resolve(values.output);
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, JSON.stringify({
            versao: 1, regra: 'R1-v1', geradoEm: new Date().toISOString(),
            manifestoSha256: createHash('sha256').update(input).digest('hex'),
            ...result,
        }, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify(result.resumo));
        console.log('Avaliação em ' + output);
    } finally {
        await db.$disconnect();
    }
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Falha ao avaliar o piloto.';
    const secret = process.env.ODA_PILOT_DATABASE_URL;
    console.error(secret ? message.split(secret).join('[URL omitida]') : message);
    process.exitCode = 1;
});
