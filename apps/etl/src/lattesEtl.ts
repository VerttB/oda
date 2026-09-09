import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient, Prisma, TipoProducao, Qualis, SharedPipelineLogger, ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog, FilaExtracaoStatus, PipelineEtapa, TipoPesquisador } from '@oda/database';
import { OPEN_ALEX_URL, DOI_URL, PROCESSED_DATA_DIR } from './commom/config';
import { stripHtml } from './commom/normalize';
import { DefaultArgs } from '../../../shared/database/generated/prisma/runtime/client';

const prisma = new PrismaClient(prismaConfig);
const pipelineLogger = new SharedPipelineLogger(prisma);
type TransactionClient = Omit<PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

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
export async function saveLattesToDb(data: any) {
    const lattesId = normalizeLattesId(data.lattes) ?? normalizeLattesId(data.lattesId);
    if (!lattesId) {
        throw new Error(`Currículo Lattes de "${data.nome || 'N/A'}" sem lattesId identificável.`);
    }

    console.log(`[ETL] 📡 Buscando dados acadêmicos externos para ${data.nome}...`);
    let openAlexData = null
    if (typeof data.orcidId === 'string' && data.orcidId.trim() !== '') {
        data.orcidId = data.orcidId.trim().split("/").pop()
        console.log(`[ETL] ORCID identificado para ${data.nome}: ${data.orcidId}`)
        openAlexData = await getOpenAlexData(data.orcidId);
        console.log("OpenAlex Para", data.nome, openAlexData)
    }
    const artigosEnriquecidos = [] as any;
    if (data.artigos && Array.isArray(data.artigos)) {
        for (const artigo of data.artigos) {
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
        }
    }
    const livrosCapitulos = data.livrosCapitulos || [];
    const producoes = await buildResearcherProductions(artigosEnriquecidos, livrosCapitulos);

    try {
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
        for (const [index, lote] of producoesLotes.entries()) {
            await prisma.$transaction(async (tx) => {
                await saveResearcherProductionsBatch(tx, pesquisadorId, lote);
            }, { maxWait: 15000, timeout: 60000 });
            console.log(`[ETL] Produções de ${data.nome}: lote ${index + 1}/${producoesLotes.length} processado (${lote.length} itens).`);
        }

        await prisma.$transaction(async (tx) => {
            await tx.filaExtracaoPesquisador.upsert({
                where: { lattesId },
                update: {
                    status: FilaExtracaoStatus.CONCLUIDO,
                    processamentoIniciadoEm: null,
                    ultimoErroId: null,
                    ultimoErroEm: null,
                },
                create: {
                    lattesId,
                    nome: data.nome?.trim() || `Pesquisador ${lattesId}`,
                    status: FilaExtracaoStatus.CONCLUIDO
                }
            });

            console.log(`[ETL] ✅ Lattes e produções de ${data.nome} processados com sucesso.`);
        }, { maxWait: 15000, timeout: 60000 });
    } catch (error) {
        console.error(`[ETL] ❌ Erro no Lattes de ${data.nome}:`, error);
        throw error;
    }
}

/**
 * Executa o ETL de um pesquisador específico a partir do caminho do seu arquivo JSON.
 * (Preparado para alterações na função interna de salvamento saveLattesToDb)
 */
export async function runPesquisadorEtl(jsonPath: string) {
    console.log(`[ETL] 🔍 Iniciando processamento do arquivo de pesquisador: ${jsonPath}`);
    if (!fs.existsSync(jsonPath)) {
        console.log(`[ETL] ⚠️ Arquivo de origem não existe (pode ter sido processado concorrentemente): ${jsonPath}`);
        return;
    }

    const content = fs.readFileSync(jsonPath, 'utf-8');
    const lattesData = JSON.parse(content);
    const lattesId = lattesData.lattesId || path.basename(jsonPath, '.json');
    const lattesFileStats = fs.statSync(jsonPath);

    const pipelineLogger = new SharedPipelineLogger(prisma);
    const pipelineLogId = await pipelineLogger.startPipelineLogger(
        ModuloSistema.ETL,
        lattesId,
        ModoExecucao.APENAS_LATTES,
        {
            comando: 'etl-pesquisador',
            arquivoJson: path.basename(jsonPath),
            tamanhoTotalBytes: lattesFileStats.size,
            artigosEncontrados: Array.isArray(lattesData.artigos) ? lattesData.artigos.length : 0,
            livrosCapitulosEncontrados: Array.isArray(lattesData.livrosCapitulos) ? lattesData.livrosCapitulos.length : 0,
        }
    );

    const t0 = performance.now();
    try {
        await saveLattesToDb(lattesData);
        const tempoMs = Math.round(performance.now() - t0);

        const lattesFileName = path.basename(jsonPath);
        const processedLattesDir = path.join(PROCESSED_DATA_DIR, 'lattes');
        if (!fs.existsSync(processedLattesDir)) fs.mkdirSync(processedLattesDir, { recursive: true });
        const destPath = path.join(processedLattesDir, lattesFileName);
        if (jsonPath !== destPath) {
            try {
                if (fs.existsSync(jsonPath)) {
                    fs.renameSync(jsonPath, destPath);
                    console.log(`[ETL] 📁 JSON Lattes ${lattesFileName} movido para ${destPath}`);
                }
            } catch (renameError: any) {
                console.warn(`[ETL] ⚠️ Não foi possível mover o arquivo Lattes ${lattesFileName}: ${renameError.message}`);
            }
        }

        await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.SUCESSO, {
            entidadeId: lattesId,
            tipoEntidade: TipoEntidadeLog.PESQUISADOR,
            tempoMs,
        });

        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.CONCLUIDO, {
            gruposGravados: 0,
            pesquisadoresAtualizados: 1,
            arquivoJson: path.basename(jsonPath),
            tamanhoTotalBytes: lattesFileStats.size,
            artigosEncontrados: Array.isArray(lattesData.artigos) ? lattesData.artigos.length : 0,
            livrosCapitulosEncontrados: Array.isArray(lattesData.livrosCapitulos) ? lattesData.livrosCapitulos.length : 0,
        });
    } catch (err: any) {
        console.error(`[ETL] ❌ Erro na carga Lattes do pesquisador ${lattesId}: ${err.message}`);
        const errorItem = await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.ERRO, {
            entidadeId: lattesId,
            tipoEntidade: TipoEntidadeLog.PESQUISADOR,
            tipoErro: TipoErroColeta.FALHA_ETL,
            mensagemErro: err.message,
            detalhesErro: err.stack,
        });
        await prisma.filaExtracaoPesquisador.update({
            where: { lattesId },
            data: {
                status: FilaExtracaoStatus.ERRO,
                processamentoIniciadoEm: null,
                ultimoErroId: errorItem?.id ?? null,
                ultimoErroEm: new Date(),
            }
        }).catch(() => undefined);

        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.ERRO);
    }
}
