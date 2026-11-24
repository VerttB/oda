import type { PrismaClient } from '@oda/database';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const preferred = ['ACSO', 'G2BC', 'NPAI', 'PIMAT'];
type Candidate = {
    grupoId: string;
    producaoId: string;
    titulo: string;
    ano: number | null;
    tipo: string;
    temDoi: boolean;
    temResumo: boolean;
    temPalavraOpenAlex: boolean;
    temTopicoOpenAlex: boolean;
    autoresDoGrupo: number;
    autoresComDataEntrada: number;
    primeiraEntradaAno: number | null;
    totalGruposNaAmostra: number;
    recorte: 'COM_CLASSIFICACAO' | 'GERAL';
};

async function prepare(db: PrismaClient, database: typeof import('@oda/database')) {
    const headOffice = {
        tipoRelacao: database.TipoRelacaoGrupoInstituicao.SEDE,
        instituicao: database.SIMCC_INSTITUICOES_WHERE,
    };
    return db.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const eligible = await tx.grupoPesquisa.findMany({
            where: { situacao: database.Situacao.CERTIFICADO, instituicoes: { some: headOffice } },
            select: {
                id: true, dgpId: true, nome: true, anoFormacao: true, areaPredominante: true,
                instituicoes: { where: headOffice, select: { instituicao: { select: { sigla: true, nome: true } } } },
            },
            orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        });
        const chosen = new Map<string, typeof eligible[number]>();
        const inclusions = preferred.map(sigla => {
            const matches = eligible.filter(group => group.nome.toUpperCase().split(/[^A-Z0-9]+/).includes(sigla));
            if (matches.length === 1) chosen.set(matches[0].id, matches[0]);
            return { sigla, encontrados: matches.map(group => group.id), incluidoPorSigla: matches.length === 1 };
        });
        const classifiedWorks = database.Prisma.sql`
            SELECT DISTINCT e.producao_id FROM execucao_enriquecimento_producao e
            WHERE EXISTS (
                SELECT FROM producao_palavra_chave pw JOIN palavra_chave w ON w.id = pw.palavra_chave_id
                WHERE pw.producao_id = e.producao_id AND w.origem = 'OPENALEX' AND pw.revisao <> 'REJEITADO'
            ) OR EXISTS (
                SELECT FROM producao_open_alex_area pa
                WHERE pa.producao_id = e.producao_id AND pa.revisao <> 'REJEITADO'
            )`;
        // A cobertura é baixa. Inclui grupos com classificação para poder comparar sinais no piloto.
        const priority = await tx.$queryRaw<{ id: string; producoes: number }[]>`
            WITH classified_works AS (${classifiedWorks})
            SELECT m.grupo_id AS id, count(DISTINCT cw.producao_id)::int AS producoes
            FROM classified_works cw
            JOIN producao_pesquisador a ON a.producao_id = cw.producao_id
            JOIN membro_grupo m ON m.pesquisador_id = a.pesquisador_id
            WHERE m.grupo_id = ANY(${eligible.map(group => group.id)}::text[])
            GROUP BY m.grupo_id ORDER BY producoes DESC, m.grupo_id LIMIT 4`;
        const eligibleById = new Map(eligible.map(group => [group.id, group]));
        for (const group of priority) chosen.set(group.id, eligibleById.get(group.id)!);
        // Alterna instituições e áreas para a amostra não concentrar os maiores grupos.
        const buckets = new Map<string, Map<string, typeof eligible>>();
        for (const group of eligible) {
            if (chosen.has(group.id)) continue;
            const institution = group.instituicoes.map(row => row.instituicao.sigla ?? row.instituicao.nome).sort()[0];
            const areas = buckets.get(institution) ?? new Map<string, typeof eligible>();
            const bucket = areas.get(group.areaPredominante) ?? [];
            bucket.push(group);
            areas.set(group.areaPredominante, bucket);
            buckets.set(institution, areas);
        }
        const remaining = [...buckets.keys()].sort().map(institution => {
            const areas = [...buckets.get(institution)!.values()];
            const next = [];
            for (let i = 0; areas.some(area => area.length > i); i++) {
                for (const area of areas) if (area[i]) next.push(area[i]);
            }
            return next;
        });
        for (let i = 0; chosen.size < 24 && remaining.some(bucket => bucket.length > i); i++) {
            for (const bucket of remaining) {
                if (chosen.size === 24) break;
                if (bucket[i]) chosen.set(bucket[i].id, bucket[i]);
            }
        }
        const groups = [...chosen.values()];
        const pairs = await tx.$queryRaw<Candidate[]>`
            WITH classified_works AS (${classifiedWorks}), member_works AS (
                SELECT m.grupo_id, a.producao_id, count(*)::int AS authors,
                       count(m.data_entrada)::int AS dated_authors,
                       min(extract(year FROM m.data_entrada))::int AS first_entry
                FROM membro_grupo m
                JOIN producao_pesquisador a ON a.pesquisador_id = m.pesquisador_id
                WHERE m.grupo_id = ANY(${groups.map(group => group.id)}::text[])
                GROUP BY m.grupo_id, a.producao_id
            ), strata AS (
                SELECT mw.*, p.titulo, p.ano, p.tipo::text AS tipo,
                       nullif(btrim(p.doi), '') IS NOT NULL AS has_doi,
                       nullif(btrim(p.resumo), '') IS NOT NULL AS has_abstract,
                       row_number() OVER (
                           PARTITION BY mw.grupo_id, p.tipo, nullif(btrim(p.doi), '') IS NOT NULL,
                                        nullif(btrim(p.resumo), '') IS NOT NULL
                           ORDER BY md5(mw.producao_id), mw.producao_id
                       ) AS sample_rank,
                       count(*) OVER (PARTITION BY mw.producao_id)::int AS group_count
                FROM member_works mw JOIN producao p ON p.id = mw.producao_id
            ), candidates AS (
                SELECT producao_id, min(sample_rank) AS priority FROM strata GROUP BY producao_id
            ), contrast AS (
                SELECT c.producao_id FROM candidates c JOIN classified_works USING (producao_id)
                ORDER BY c.priority, md5(c.producao_id), c.producao_id LIMIT 25
            ), general AS (
                SELECT c.producao_id FROM candidates c WHERE NOT EXISTS (
                    SELECT FROM contrast WHERE contrast.producao_id = c.producao_id
                )
                ORDER BY c.priority, md5(c.producao_id), c.producao_id LIMIT (500 - (SELECT count(*) FROM contrast))
            ), sample AS (
                SELECT producao_id, 'COM_CLASSIFICACAO' AS recorte FROM contrast
                UNION ALL SELECT producao_id, 'GERAL' FROM general
            )
            SELECT s.grupo_id AS "grupoId", s.producao_id AS "producaoId", s.titulo, s.ano, s.tipo,
                   s.has_doi AS "temDoi", s.has_abstract AS "temResumo", s.authors AS "autoresDoGrupo",
                   EXISTS (SELECT FROM producao_palavra_chave pw JOIN palavra_chave w ON w.id = pw.palavra_chave_id
                           WHERE pw.producao_id = s.producao_id AND w.origem = 'OPENALEX'
                             AND pw.revisao <> 'REJEITADO') AS "temPalavraOpenAlex",
                   EXISTS (SELECT FROM producao_open_alex_area pa WHERE pa.producao_id = s.producao_id
                             AND pa.revisao <> 'REJEITADO') AS "temTopicoOpenAlex",
                   s.dated_authors AS "autoresComDataEntrada", s.first_entry AS "primeiraEntradaAno",
                   s.group_count AS "totalGruposNaAmostra", sample.recorte
            FROM strata s JOIN sample USING (producao_id)
            ORDER BY s.grupo_id, s.producao_id`;
        const byGroup = new Map(groups.map(group => [group.id, group]));
        return {
            versao: 1, geradoEm: new Date().toISOString(), tipo: 'AMOSTRA_PARA_REVISAO',
            gruposElegiveis: eligible.length, inclusoes: inclusions,
            grupos: groups, gruposPriorizadosPorClassificacao: priority,
            producoesDistintas: new Set(pairs.map(pair => pair.producaoId)).size,
            pares: pairs.map(pair => {
                const formation = byGroup.get(pair.grupoId)?.anoFormacao;
                const flags: string[] = [];
                if (pair.ano === null) flags.push('SEM_ANO');
                if (pair.ano !== null && formation && pair.ano < formation) flags.push('ANTERIOR_A_FORMACAO_DO_GRUPO');
                if (pair.ano !== null && pair.primeiraEntradaAno !== null &&
                    pair.autoresComDataEntrada === pair.autoresDoGrupo && pair.ano < pair.primeiraEntradaAno) {
                    flags.push('ANTERIOR_A_ENTRADA_DOS_AUTORES_CONHECIDOS');
                }
                if (pair.autoresComDataEntrada < pair.autoresDoGrupo) flags.push('HISTORICO_DE_VINCULO_INCOMPLETO');
                if (!pair.temResumo) flags.push('SEM_RESUMO');
                if (pair.totalGruposNaAmostra > 1) flags.push('CANDIDATA_EM_MULTIPLOS_GRUPOS');
                return { ...pair, flags };
            }),
        };
    }, { isolationLevel: 'RepeatableRead', timeout: 60_000 });
}

async function main() {
    const { values } = parseArgs({ options: { output: { type: 'string' }, help: { type: 'boolean' } } });
    if (values.help) {
        console.log('Defina ODA_PILOT_DATABASE_URL para um PostgreSQL local e informe --output ARQUIVO.json.');
        console.log('Exporta até 24 grupos e 500 produções candidatas à revisão. A consulta é somente leitura.');
        return;
    }
    const connectionString = process.env.ODA_PILOT_DATABASE_URL;
    if (!connectionString || !values.output) throw new Error('Defina ODA_PILOT_DATABASE_URL e informe --output ARQUIVO.json.');
    const target = new URL(connectionString);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
        !['postgres:', 'postgresql:'].includes(target.protocol)) {
        throw new Error('Use um PostgreSQL local em loopback para preparar o piloto.');
    }
    // O adapter padrão do workspace lê DATABASE_URL na importação.
    process.env.DATABASE_URL = connectionString;
    const database = await import('@oda/database');
    const db = new database.PrismaClient(database.prismaConfig);
    try {
        const result = await prepare(db, database);
        if (!result.grupos.length) throw new Error('Nenhum grupo SIMCC certificado foi encontrado.');
        const output = resolve(values.output);
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
        console.log(`Amostra em ${output}: ${result.grupos.length} grupos, ${result.producoesDistintas} produções, ${result.pares.length} pares.`);
    } finally {
        await db.$disconnect();
    }
}

main().catch((error: unknown) => {
    // Erros de inicialização podem conter a URL de conexão.
    const message = error instanceof Error ? error.message : 'Falha ao preparar o piloto.';
    const secret = process.env.ODA_PILOT_DATABASE_URL;
    console.error(secret ? message.split(secret).join('[URL omitida]') : message);
    process.exitCode = 1;
});
