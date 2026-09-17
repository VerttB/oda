import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient, Prisma, TipoProducao, Qualis, SharedPipelineLogger, ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog, PipelineEtapa, TipoPesquisador } from '@oda/database';
import { OPEN_ALEX_URL, DOI_URL } from './commom/config';
import { stripHtml } from './commom/normalize';
import { DefaultArgs } from '../../../shared/database/generated/prisma/runtime/client';
import { EtlInputError, inspectEtlFile, moveEtlFileToProcessed } from './commom/etlFile';

const prisma = new PrismaClient(prismaConfig);
const pipelineLogger = new SharedPipelineLogger(prisma);
type TransactionClient = Omit<PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

export type ResearcherEtlProgressUpdate = {
    etapa: 'LENDO_JSON' | 'VALIDANDO' | 'ENRIQUECENDO_ORCID' | 'ENRIQUECENDO_PRODUCOES' | 'SALVANDO_PESQUISADOR' | 'SALVANDO_PRODUCOES' | 'MOVENDO_ARQUIVO' | 'CONCLUIDO';
    percentual: number;
    itensProcessados: number | null;
    itensTotal: number | null;
    loteAtual: number | null;
    lotesTotal: number | null;
};
export type ResearcherEtlProgressReporter = (progress: ResearcherEtlProgressUpdate) => Promise<void>;

type ResearcherProductionInput = {
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
};

function normalizeLattesId(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/https?:\/\/lattes\.cnpq\.br\//, '').trim();
    return clean.length > 0 ? clean : null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

export function isValidPublicationYear(value: number | null | undefined): value is number {
    const maxYear = new Date().getFullYear() + 1;
    return Number.isInteger(value) && value >= 1900 && value <= maxYear;
}

function parsePublicationYear(value: unknown): number | null {
    if (typeof value === 'number') {
        return isValidPublicationYear(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const parsed = parseInt(value.replace(/\D/g, ''), 10);
    return isValidPublicationYear(parsed) ? parsed : null;
}

export async function getOpenAlexData(orcid:string) {
    try{
        const url = `${OPEN_ALEX_URL}?api_key=${process.env.OPEN_ALEX_KEY}&filter=orcid:${orcid}`
        const res = await fetch(url)
        if (!res.ok || res.status == 404){ throw new Error(`Orcid ${orcid} não encontrado no openAlex`)}
        const data = await res.json()
        if(data.meta.count == 0) return null
        const { id } = data.results[0]
        const {h_index, i10_index} = data.results[0].summary_stats
        return { h_index, i10_index, openAlexId: id}
    }catch(e: unknown){
        if(e instanceof Error){
            console.log(`Ocorrou um erro ao procurar dados openAlex para ${orcid} - ${e.message}`)
        }
    }
}

function restoreAbstractFromInvertedIndex(index: Record<string, number[]>): string {
    const wordsByPosition: string[] = [];

    for (const [word, positions] of Object.entries(index)) {
        for (const position of positions) {
            wordsByPosition[position] = word;
        }
    }

    return wordsByPosition.filter(Boolean).join(' ');
}

export async function linkProductionOpenAlex(doi: string) {
    try {
        const cleanDoi = doi.trim();
        const url = `https://api.openalex.org/works/doi:${encodeURIComponent(cleanDoi)}?api_key=${process.env.OPEN_ALEX_KEY}`;
        const res = await fetch(url);
        if (!res.ok || res.status === 404) throw new Error(`Artigo não encontrado no OpenAlex`);

        const data = await res.json();
        const abstract = data?.abstract
            || (data?.abstract_inverted_index ? restoreAbstractFromInvertedIndex(data.abstract_inverted_index) : "");

        const publicationYear = isValidPublicationYear(data?.publication_year)
            ? data.publication_year
            : null;
        const issn = data?.issn_1
            || data?.primary_location?.source?.issn_l
            || data?.primary_location?.source?.issn?.[0]
            || "";

        return { abstract, publicationYear, issn };
    } catch (e: unknown) {
        if (e instanceof Error) {
            console.log(`Ocorrou um erro ao procurar dados OpenAlex para o doi: ${doi} - ${e.message}`)
        }
    }
}

export async function linkProductionDoi(doi: string) {
    try{
        const url = `${DOI_URL}${doi}`
        const res = await fetch(url)
        if (!res.ok || res.status == 404) throw new Error(`Artigo não encontrado na api do DOI`)
        
        const data = await res.json() 
        const abstract: string = data?.abstract ? stripHtml(data.abstract) : ""
        const publisher: string = data?.publisher || ""
        const rawUrl: string = data?.link?.[0]?.URL || data?.license?.[0]?.URL || ""
        const productionUrl = rawUrl.replace(/\/pdf\/?$/i, '')
        const issn: string = data?.ISSN?.[0] || data?.issn?.[0] || data?.['issn-type']?.[0]?.value || ""
        return {abstract, publisher, licenseUrl: productionUrl, issn}
    }catch(e: unknown){
         if(e instanceof Error){
            console.log(`Ocorrou um erro ao informações para o doi: ${doi} - ${e.message}`)
        }
    }
}

let qualisMap: Map<string, string> | null = null;

function loadQualisMap() {
    if (qualisMap) return qualisMap;
    qualisMap = new Map<string, string>();
    try {
        let filePath = path.resolve(__dirname, 'commom/qualis-capes-2017-2020.json');
        if (!fs.existsSync(filePath)) {
            filePath = path.resolve(__dirname, '../src/commom/qualis-capes-2017-2020.json');
        }
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            for (const item of data) {
                if (item.issn && item.qualis) {
                    const cleanIssn = item.issn.replace(/-/g, '').trim().toUpperCase();
                    qualisMap.set(cleanIssn, item.qualis);
                }
            }
        }
    } catch (e: any) {
        console.error(`[ETL-QUALIS] Erro ao carregar arquivo de Qualis: ${e.message}`);
    }
    return qualisMap;
}

export async function linkProductionQualis(issn: string): Promise<Qualis | null> {
    if (!issn) return null;
    const map = loadQualisMap();
    const clean = issn.replace(/-/g, '').trim().toUpperCase();
    return (map.get(clean) as Qualis) || null;
}


async function buildResearcherProductions(artigos: any[], livrosCapitulos: any[]): Promise<ResearcherProductionInput[]> {
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
            veiculo: artigo?.veiculo || null,
            issn: issn || null,
            qualis: qualis || null,
            resumo: artigo?.resumo || null,
        });
    }

    for (const livro of livrosCapitulos) {
        if (!livro.titulo) continue;

        const ano = parsePublicationYear(livro.ano);
        const cleanDoi = livro.doi ? livro.doi.trim() : null;

        producoes.push({
            titulo: livro.titulo.trim(),
            ano,
            anoFonte: 'LATTES',
            tipo: TipoProducao.LIVROCAPITULO,
            doi: cleanDoi || null,
            url: livro.url || null,
            veiculo: livro.editora || livro.veiculo || null,
            issn: null,
            qualis: null,
            resumo: null,
        });
    }

    return producoes;
}

async function saveResearcherProductionsBatch(tx: TransactionClient, pesquisadorId: string, producoes: ResearcherProductionInput[]) {
    for (const item of producoes) {
        if (!item.titulo) continue;

        let producao = null;

        if (item.doi) {
            producao = await tx.producao.findUnique({
                where: { doi: item.doi }
            });
        }

        if (!producao) {
            producao = await tx.producao.findFirst({
                where: {
                    titulo: { equals: item.titulo, mode: 'insensitive' },
                    ano: item.ano
                }
            });
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
                    resumo: item.resumo
                }
            });
        } else {
            const deveAtualizarAno =
                isValidPublicationYear(item.ano)
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
                }
            });
        }

        await tx.producaoPesquisador.upsert({
            where: {
                producaoId_pesquisadorId: {
                    producaoId: producao.id,
                    pesquisadorId
                }
            },
            update: {},
            create: {
                producaoId: producao.id,
                pesquisadorId
            }
        });
    }
}

/**
 * Lógica de persistência para Currículos Lattes
 */
export async function saveLattesToDb(data: any, reportProgress: ResearcherEtlProgressReporter = async () => {}) {
    const lattesId = normalizeLattesId(data.lattes) ?? normalizeLattesId(data.lattesId);
    if (!lattesId) {
        throw new Error(`Currículo Lattes de "${data.nome || 'N/A'}" sem lattesId identificável.`);
    }

    console.log(`[ETL] 📡 Buscando dados acadêmicos externos para ${data.nome}...`);
    await reportProgress({ etapa: 'ENRIQUECENDO_ORCID', percentual: 15, itensProcessados: null, itensTotal: null, loteAtual: null, lotesTotal: null });
    let openAlexData = null
    if (typeof data.orcidId === 'string' && data.orcidId.trim() !== '') {
        data.orcidId = data.orcidId.trim().split("/").pop()
        console.log(`[ETL] ORCID identificado para ${data.nome}: ${data.orcidId}`)
        openAlexData = await getOpenAlexData(data.orcidId);
        console.log("OpenAlex Para", data.nome, openAlexData)
    }
    const artigosEnriquecidos = [] as any;
    if (data.artigos && Array.isArray(data.artigos)) {
        for (const [index, artigo] of data.artigos.entries()) {
            let resumo = null, veiculo = null, url = null, issnDoi = null, issnOpenAlex = null;
            let anoOpenAlex: number | null = null;
            const anoLattes = parsePublicationYear(artigo.ano);
            if (artigo.doi) {
                const artigosExtra = await linkProductionDoi(artigo.doi);
                
                if (artigosExtra) {
                    resumo = artigosExtra.abstract ? stripHtml(artigosExtra.abstract) : null;
                    veiculo = artigosExtra.publisher
                    url = artigosExtra.licenseUrl
                    issnDoi = artigosExtra.issn || null
                }

                const precisaOpenAlex =
                    !resumo
                    || !(artigo.issn || artigo.ISSN || issnDoi)
                    || !isValidPublicationYear(anoLattes);

                if (precisaOpenAlex) {
                    const openAlexExtra = await linkProductionOpenAlex(artigo.doi);
                    resumo = resumo || (openAlexExtra?.abstract ? stripHtml(openAlexExtra.abstract) : null);
                    issnOpenAlex = openAlexExtra?.issn || null;
                    anoOpenAlex = openAlexExtra?.publicationYear || null;
                }
            }
            const anoFinal = isValidPublicationYear(anoOpenAlex) ? anoOpenAlex : anoLattes;
            artigosEnriquecidos.push({
                ...artigo,
                ano: anoFinal,
                anoFonte: isValidPublicationYear(anoOpenAlex) ? 'OPENALEX' : 'LATTES',
                issn: artigo.issn || artigo.ISSN || issnDoi || issnOpenAlex,
                resumo,
                veiculo,
                url
            });
            await reportProgress({
                etapa: 'ENRIQUECENDO_PRODUCOES', percentual: 20 + Math.round(((index + 1) / Math.max(data.artigos.length, 1)) * 35),
                itensProcessados: index + 1, itensTotal: data.artigos.length, loteAtual: null, lotesTotal: null,
            });
        }
    }
    const livrosCapitulos = data.livrosCapitulos || [];
    const producoes = await buildResearcherProductions(artigosEnriquecidos, livrosCapitulos);

    try {
        await reportProgress({ etapa: 'SALVANDO_PESQUISADOR', percentual: 60, itensProcessados: null, itensTotal: null, loteAtual: null, lotesTotal: null });
        const pesquisadorId = await prisma.$transaction(async (tx) => {
            let pesquisador = await tx.pesquisador.findFirst({
                where: {
                    OR: [
                        { lattesId },
                        ...(data.nome ? [{ nome: { equals: data.nome.trim(), mode: 'insensitive' as const } }] : []),
                    ],
                },
            });

            if (!pesquisador) {
                pesquisador = await tx.pesquisador.create({
                    data: {
                        nome: data.nome?.trim() || `Pesquisador ${lattesId}`,
                        lattesId,
                        tipo: TipoPesquisador.PESQUISADOR,
                    }
                });
            }

            await tx.pesquisador.update({
                where: { id: pesquisador.id },
                data: {
                    nome: data.nome?.trim() || pesquisador.nome,
                    lattesId,
                    orcidId: data?.orcidId || null,
                    indexH: openAlexData?.h_index || null,
                    indexI10: openAlexData?.i10_index || null,
                    openAlexId: openAlexData?.openAlexId.split("/").pop() || null,
                    imageUrl: `/static/${lattesId}.webp`
                }
            });

            return pesquisador.id;
        }, { maxWait: 15000, timeout: 30000 });

        const producoesLotes = chunkArray(producoes, 20);
        if (!producoesLotes.length) {
            await reportProgress({
                etapa: 'SALVANDO_PRODUCOES', percentual: 90,
                itensProcessados: 0, itensTotal: 0, loteAtual: 0, lotesTotal: 0,
            });
        }
        for (const [index, lote] of producoesLotes.entries()) {
            await prisma.$transaction(async (tx) => {
                await saveResearcherProductionsBatch(tx, pesquisadorId, lote);
            }, { maxWait: 15000, timeout: 60000 });
            await reportProgress({
                etapa: 'SALVANDO_PRODUCOES', percentual: 65 + Math.round(((index + 1) / Math.max(producoesLotes.length, 1)) * 25),
                itensProcessados: Math.min((index + 1) * 20, producoes.length), itensTotal: producoes.length,
                loteAtual: index + 1, lotesTotal: producoesLotes.length,
            });
            console.log(`[ETL] Produções de ${data.nome}: lote ${index + 1}/${producoesLotes.length} processado (${lote.length} itens).`);
        }
        console.log(`[ETL] ✅ Lattes e produções de ${data.nome} processados com sucesso.`);
        return { lattesId, producoesProcessadas: producoes.length, lotesProducoes: producoesLotes.length };
    } catch (error) {
        console.error(`[ETL] ❌ Erro no Lattes de ${data.nome}:`, error);
        throw error;
    }
}

export type ResearcherEtlResult = {
    lattesId: string;
    arquivoJson: string;
    tamanhoBytes: number;
    artigosProcessados: number;
    livrosCapitulosProcessados: number;
    producoesProcessadas: number;
    lotesProducoes: number;
    arquivoMovido: boolean;
};

export async function processResearcherEtlFile(
    jsonPath: string,
    expectedLattesId?: string,
    reportProgress: ResearcherEtlProgressReporter = async () => {},
): Promise<ResearcherEtlResult> {
    await reportProgress({ etapa: 'LENDO_JSON', percentual: 5, itensProcessados: null, itensTotal: null, loteAtual: null, lotesTotal: null });
    if (!fs.existsSync(jsonPath)) throw new Error(`Arquivo Lattes nao encontrado: ${jsonPath}`);

    const fileInfo = inspectEtlFile(jsonPath);
    let lattesData: any;
    try {
        lattesData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (error) {
        throw new EtlInputError(`JSON Lattes invalido: ${error instanceof Error ? error.message : String(error)}`);
    }

    await reportProgress({ etapa: 'VALIDANDO', percentual: 10, itensProcessados: null, itensTotal: null, loteAtual: null, lotesTotal: null });
    const lattesId = normalizeLattesId(lattesData.lattes) ?? normalizeLattesId(lattesData.lattesId)
        ?? normalizeLattesId(path.basename(jsonPath, '.json'));
    if (!lattesId || !/^\d{16}$/.test(lattesId)) {
        throw new EtlInputError(`ID Lattes invalido no JSON: ${lattesId || 'ausente'}.`);
    }
    if (expectedLattesId && lattesId !== expectedLattesId) {
        throw new EtlInputError(`O JSON pertence ao pesquisador ${lattesId}, mas o job esperava ${expectedLattesId}.`);
    }
    lattesData.lattesId = lattesId;

    const saved = await saveLattesToDb(lattesData, reportProgress);
    await reportProgress({ etapa: 'MOVENDO_ARQUIVO', percentual: 95, itensProcessados: null, itensTotal: null, loteAtual: null, lotesTotal: null });
    const arquivoMovido = moveEtlFileToProcessed(jsonPath, 'lattes');
    const result = {
        lattesId,
        arquivoJson: fileInfo.arquivoJson,
        tamanhoBytes: fileInfo.tamanhoBytes,
        artigosProcessados: Array.isArray(lattesData.artigos) ? lattesData.artigos.length : 0,
        livrosCapitulosProcessados: Array.isArray(lattesData.livrosCapitulos) ? lattesData.livrosCapitulos.length : 0,
        producoesProcessadas: saved.producoesProcessadas,
        lotesProducoes: saved.lotesProducoes,
        arquivoMovido,
    };
    await reportProgress({ etapa: 'CONCLUIDO', percentual: 100, itensProcessados: result.producoesProcessadas, itensTotal: result.producoesProcessadas, loteAtual: result.lotesProducoes, lotesTotal: result.lotesProducoes });
    return result;
}

export async function runPesquisadorEtl(jsonPath: string) {
    const resolvedPath = path.resolve(jsonPath);
    const fileInfo = fs.existsSync(resolvedPath) ? inspectEtlFile(resolvedPath) : null;
    const lattesId = path.basename(jsonPath, '.json');
    const pipelineLogId = await pipelineLogger.startPipelineLogger(
        ModuloSistema.ETL, null, ModoExecucao.APENAS_LATTES,
        { comando: 'etl-pesquisador', arquivoJson: path.basename(jsonPath), tamanhoTotalBytes: fileInfo?.tamanhoBytes },
    );
    const startedAt = performance.now();
    try {
        const result = await processResearcherEtlFile(resolvedPath);
        await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.SUCESSO, {
            entidadeId: result.lattesId, tipoEntidade: TipoEntidadeLog.PESQUISADOR,
            tempoMs: Math.round(performance.now() - startedAt),
        });
        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.CONCLUIDO, {
            pesquisadoresAtualizados: 1, producoesVinculadas: result.producoesProcessadas,
            arquivoJson: result.arquivoJson, tamanhoTotalBytes: result.tamanhoBytes,
            artigosEncontrados: result.artigosProcessados,
            livrosCapitulosEncontrados: result.livrosCapitulosProcessados,
        });
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.ERRO, {
            entidadeId: /^\d{16}$/.test(lattesId) ? lattesId : path.basename(jsonPath),
            tipoEntidade: TipoEntidadeLog.PESQUISADOR, tipoErro: TipoErroColeta.FALHA_ETL,
            mensagemErro: message, detalhesErro: error instanceof Error ? error.stack : undefined,
            tempoMs: Math.round(performance.now() - startedAt),
        });
        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.ERRO, { pesquisadoresAtualizados: 0, arquivoJson: path.basename(jsonPath) });
        throw error;
    }
}
