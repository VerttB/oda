import {
    Prisma,
    PrismaClient,
    Qualis,
    TipoProducao,
} from '@oda/database';
import { DefaultArgs } from '../../../../shared/database/generated/prisma/runtime/client';
import { isValidPublicationYear, linkProductionQualis, parsePublicationYear } from './enrichment';
import { classificationLockKeys, OpenAlexEvidence, saveClassification } from './saveClassification';

type TransactionClient = Omit<
    PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
>;

export type ResearcherProductionInput = {
    titulo: string;
    ano: number | null;
    anoFonte?: 'LATTES' | 'OPENALEX';
    tipo: TipoProducao;
    doi: string | null;
    url: string | null;
    veiculo: string | null;
    issn: string | null;
    qualis: Qualis | null;
    resumo: string | null;
    openAlex?: OpenAlexEvidence | null;
};

type ExistingProductionMatch = {
    id: string;
    ano: number | null;
    doi: string | null;
    url: string | null;
    veiculo: string | null;
    resumo: string | null;
    issn: string | null;
    qualis: Qualis | null;
};

const tipoProducaoDbValue: Record<TipoProducao, string> = {
    [TipoProducao.ARTIGO]: 'artigo',
    [TipoProducao.LIVROCAPITULO]: 'livro_capitulo',
    [TipoProducao.OUTRA]: 'outra',
};

export function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

export async function buildResearcherProductions(
    artigos: any[],
    livrosCapitulos: any[],
): Promise<ResearcherProductionInput[]> {
    const producoes: ResearcherProductionInput[] = [];

    for (const artigo of artigos) {
        if (!artigo.titulo) continue;

        const ano = parsePublicationYear(artigo.ano);
        const cleanDoi = artigo.doi ? artigo.doi.trim() : null;
        const issn = artigo.issn || artigo.ISSN || null;
        const qualis = issn ? await linkProductionQualis(issn) : null;

        producoes.push({
            titulo: artigo.titulo.trim(),
            ano,
            anoFonte: artigo.anoFonte,
            tipo: TipoProducao.ARTIGO,
            doi: cleanDoi || null,
            url: artigo.url || null,
            veiculo: artigo.veiculo || null,
            issn: issn || null,
            qualis: qualis || null,
            resumo: artigo.resumo || null,
            openAlex: artigo.openAlex ?? null,
        });
    }

    for (const livro of livrosCapitulos) {
        if (!livro.titulo) continue;

        const anoOpenAlex = livro.openAlex?.publicationYear;
        const ano = isValidPublicationYear(anoOpenAlex) ? anoOpenAlex : parsePublicationYear(livro.ano);
        const cleanDoi = livro.doi ? livro.doi.trim() : null;
        producoes.push({
            titulo: livro.titulo.trim(),
            ano,
            anoFonte: isValidPublicationYear(anoOpenAlex) ? 'OPENALEX' : 'LATTES',
            tipo: TipoProducao.LIVROCAPITULO,
            doi: cleanDoi || null,
            url: livro.url || null,
            veiculo: livro.editora || livro.veiculo || null,
            issn: livro.openAlex?.issn || null,
            qualis: null,
            resumo: livro.openAlex?.abstract || null,
            openAlex: livro.openAlex ?? null,
        });
    }

    return producoes;
}

export async function saveResearcherProductionsBatch(
    tx: TransactionClient,
    pesquisadorId: string,
    producoes: ResearcherProductionInput[],
) {
    // Lotes de autores distintos podem conter as mesmas produções.
    // Ordenação global dos locks evita deadlocks entre lotes com ordem diferente.
    const keys=[...new Set(producoes.filter(p=>p.titulo).flatMap(p=>[
        'titulo:'+p.titulo.toLocaleLowerCase('pt-BR')+':'+p.ano+':'+p.tipo,
        ...(p.doi?['doi:'+p.doi.toLocaleLowerCase('en-US')]:[]),
        ...(p.doi && p.openAlex ? classificationLockKeys(p.doi, p.openAlex) : []),
    ]))];
    if(keys.length) await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(k)::text FROM (
          SELECT DISTINCT hashtextextended(value,0) k FROM unnest(${keys}::text[]) value ORDER BY k
        ) locks
    `;
    for (const item of producoes) {
        if (!item.titulo) continue;

        let producao = null;
        if (item.doi) {
            producao = await tx.producao.findUnique({
                where: { doi: item.doi },
            });
        }

        if (!producao) {
            const anoCondition = item.ano === null
                ? Prisma.sql`ano IS NULL`
                : Prisma.sql`ano = ${item.ano}`;
            const producoesEncontradas = await tx.$queryRaw<ExistingProductionMatch[]>(Prisma.sql`
                SELECT
                    id,
                    ano,
                    doi,
                    url,
                    veiculo,
                    resumo,
                    issn,
                    qualis
                FROM public.producao
                WHERE lower(titulo) = lower(${item.titulo})
                    AND ${anoCondition}
                    AND tipo::text = ${tipoProducaoDbValue[item.tipo]}
                    AND (${!item.doi} OR doi IS NULL)
                LIMIT 2
            `);

            if (producoesEncontradas.length > 1 && !item.doi) {
                throw new Error(
                    `Correspondência ambígua para produção sem DOI (ano: ${item.ano ?? 'ausente'}, tipo: ${item.tipo}); ` +
                    'mais de um registro possui o mesmo título, ano e tipo.',
                );
            }

            if (producoesEncontradas.length > 1 && item.doi) {
                console.warn(
                    '[ETL] Correspondência ambígua com DOI; será criado um registro identificado pelo DOI.',
                    { ano: item.ano, candidatosSemDoi: producoesEncontradas.length },
                );
            } else {
                producao = producoesEncontradas[0] ?? null;
            }
        }

        if (!producao) {
            producao = await tx.producao.create({
                data: {
                    titulo: item.titulo,
                    ano: item.ano,
                    tipo: item.tipo,
                    doi: item.doi,
                    url: item.url,
                    veiculo: item.veiculo,
                    issn: item.issn,
                    qualis: item.qualis,
                    resumo: item.resumo,
                },
            });
        } else {
            const deveAtualizarAno = isValidPublicationYear(item.ano)
                && (item.anoFonte === 'OPENALEX' || !isValidPublicationYear(producao.ano));

            producao = await tx.producao.update({
                where: { id: producao.id },
                data: {
                    ano: deveAtualizarAno ? item.ano : producao.ano,
                    doi: item.doi || producao.doi,
                    veiculo: item.veiculo || producao.veiculo,
                    url: item.url || producao.url,
                    resumo: item.resumo || producao.resumo,
                    issn: item.issn || producao.issn,
                    qualis: item.qualis || producao.qualis,
                },
            });
        }

        // Uma produção pode ser compartilhada; garantir o vínculo deste pesquisador.
        await tx.producaoPesquisador.upsert({
            where: {
                producaoId_pesquisadorId: {
                    producaoId: producao.id,
                    pesquisadorId,
                },
            },
            update: {},
            create: {
                producaoId: producao.id,
                pesquisadorId,
            },
        });
        if (item.doi && item.openAlex) await saveClassification(tx, producao.id, item.doi, item.openAlex);
    }
}
