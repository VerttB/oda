import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient, SharedPipelineLogger, ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog, PipelineEtapa, TipoPesquisador } from '@oda/database';
import { stripHtml } from './commom/normalize';
import { getOrCreateAreaConhecimentoHierarchy } from './commom/database';
import { EtlInputError, inspectEtlFile, moveEtlFileToProcessed } from './commom/etlFile';
import { getOpenAlexData, isValidPublicationYear, linkProductionDoi, linkProductionOpenAlex, linkProductionQualis, parsePublicationYear } from './lattes/enrichment';
import { buildResearcherProductions, chunkArray, saveResearcherProductionsBatch } from './lattes/productions';

export { getOpenAlexData, isValidPublicationYear, linkProductionDoi, linkProductionOpenAlex, linkProductionQualis };

const prisma = new PrismaClient(prismaConfig);
const pipelineLogger = new SharedPipelineLogger(prisma);

export type ResearcherEtlProgressUpdate = {
    etapa: 'LENDO_JSON' | 'VALIDANDO' | 'ENRIQUECENDO_ORCID' | 'ENRIQUECENDO_PRODUCOES' | 'SALVANDO_PESQUISADOR' | 'SALVANDO_PRODUCOES' | 'MOVENDO_ARQUIVO' | 'CONCLUIDO';
    percentual: number;
    itensProcessados: number | null;
    itensTotal: number | null;
    loteAtual: number | null;
    lotesTotal: number | null;
};
export type ResearcherEtlProgressReporter = (progress: ResearcherEtlProgressUpdate) => Promise<void>;

function normalizeLattesId(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/https?:\/\/lattes\.cnpq\.br\//, '').trim();
    return clean.length > 0 ? clean : null;
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

            const areasAtuacao: string[] = Array.isArray(data.areasAtuacao)
                ? [...new Set<string>(data.areasAtuacao.filter((area: unknown): area is string => typeof area === 'string').map((area: string) => area.trim()).filter((area: string) => area.length > 0))]
                : [];
            for (const areaPath of areasAtuacao) {
                const area = await getOrCreateAreaConhecimentoHierarchy(tx, areaPath);
                if (!area) continue;
                await tx.pesquisadoresAreaConhecimento.upsert({
                    where: { pesquisadorId_areaId: { pesquisadorId: pesquisador.id, areaId: area.id } },
                    update: {},
                    create: { pesquisadorId: pesquisador.id, areaId: area.id },
                });
            }

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
