import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient, Prisma, TipoProducao, Qualis, SharedPipelineLogger, ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog, FilaExtracaoStatus, PipelineEtapa } from '@oda/database';
import { OPEN_ALEX_URL, DOI_URL, PROCESSED_DATA_DIR } from './commom/config';
import { stripHtml } from './commom/normalize';
import { DefaultArgs } from '../../../shared/database/generated/prisma/runtime/client';

const prisma = new PrismaClient(prismaConfig);
const pipelineLogger = new SharedPipelineLogger(prisma);
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

export async function linkProductionDoi(doi: string) {
    try{
        const url = `${DOI_URL}${doi}`
        const res = await fetch(url)
        if (!res.ok || res.status == 404) throw new Error(`Artigo não encontrado na api do DOI`)
        
        const data = await res.json() 
        const abstract: string = data?.abstract ? stripHtml(data.abstract) : ""
        const publisher: string = data?.publisher || ""
        const licenseUrl: string = data?.license?.[0]?.URL || ""
        return {abstract, publisher, licenseUrl} 
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


async function saveResearcherProductions(tx: Omit<PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">, pesquisadorId: string, artigos: any[], livrosCapitulos: any[]) {
    for (const artigo of artigos) {
        if (!artigo.titulo) continue;

        const anoInt = artigo.ano ? parseInt(artigo.ano.replace(/\D/g, ''), 10) : null;
        const cleanDoi = artigo.doi ? artigo.doi.trim() : null;

        let producao = null;
        
        if (cleanDoi) {
            producao = await tx.producao.findUnique({
                where: { doi: cleanDoi }
            });
        }

        if (!producao) {
            producao = await tx.producao.findFirst({
                where: {
                    titulo: { equals: artigo.titulo.trim(), mode: 'insensitive' },
                    ano: anoInt
                }
            });
        }
        const issn = artigo.issn || artigo.ISSN || null;
        const qualis = issn ? await linkProductionQualis(issn) : null;

        if (!producao) {
            producao = await tx.producao.create({
                data: {
                    titulo: artigo.titulo.trim(),
                    ano: anoInt,
                    tipo: TipoProducao.ARTIGO,
                    doi: cleanDoi || null,
                    url: artigo.url || null,
                    veiculo: artigo?.veiculo || null,
                    issn: issn || null,
                    qualis: qualis || null,
                    resumo: artigo?.resumo || null
                }
            });
        } else {
            producao = await tx.producao.update({
                where: { id: producao.id },
                data: {
                    doi: cleanDoi || producao.doi,
                    veiculo: artigo.nomePeriodico || artigo.veiculo || producao.veiculo,
                    resumo: artigo.resumo || producao.resumo,
                    issn: issn || producao.issn,
                    qualis: qualis || (producao.issn ? await linkProductionQualis(producao.issn) : null)
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

    for (const livro of livrosCapitulos) {
        if (!livro.titulo) continue;

        const anoInt = livro.ano ? parseInt(livro.ano.replace(/\D/g, ''), 10) : null;
        const cleanDoi = livro.doi ? livro.doi.trim() : null;

        let producao = null;

        if (cleanDoi) {
            producao = await tx.producao.findUnique({
                where: { doi: cleanDoi }
            });
        }

        if (!producao) {
            producao = await tx.producao.findFirst({
                where: {
                    titulo: { equals: livro.titulo.trim(), mode: 'insensitive' },
                    ano: anoInt
                }
            });
        }

        if (!producao) {
            producao = await tx.producao.create({
                data: {
                    titulo: livro.titulo.trim(),
                    ano: anoInt,
                    tipo: TipoProducao.LIVROCAPITULO,
                    doi: cleanDoi || null,
                    url: livro.url || null,
                    veiculo: livro.editora || livro.veiculo || null,
                }
            });
        } else {
            producao = await tx.producao.update({
                where: { id: producao.id },
                data: {
                    doi: cleanDoi || producao.doi,
                    veiculo: livro.editora || livro.veiculo || producao.veiculo
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
    console.log(`[ETL] 📡 Buscando dados acadêmicos externos para ${data.nome}...`);
    let openAlexData = null
    if(data.orcidId != "" && data.orcidId != undefined)
        console.log(data.orcidId)
        data.orcidId = data.orcidId.split("/").pop()
        openAlexData = await getOpenAlexData( data.orcidId);
        console.log("OpenAlex Para", data.nome, openAlexData)
    const artigosEnriquecidos = [] as any;
    if (data.artigos && Array.isArray(data.artigos)) {
        for (const artigo of data.artigos) {
            let resumo = null, veiculo = null, url = null;
            if (artigo.doi) {
                const artigosExtra = await linkProductionDoi(artigo.doi);
                
                if (artigosExtra) {
                    resumo = artigosExtra.abstract ? stripHtml(artigosExtra.abstract) : null;
                    veiculo = artigosExtra.publisher
                    url = artigosExtra.licenseUrl
                }
            }
            artigosEnriquecidos.push({
                ...artigo,
                resumo,
                veiculo,
                url
            });
        }
    }
    const livrosCapitulos = data.livrosCapitulos || [];

    try {
        await prisma.$transaction(async (tx) => {
            const pesquisador = await tx.pesquisador.findFirst({
                where: { lattesId: data.lattes}
            });

            if (!pesquisador) {
                throw new Error(`Pesquisador "${data.nome}" (ID: ${data.lattes}) não encontrado no banco de dados relacional.`);
            }

            await tx.pesquisador.update({
                where: { id: pesquisador.id },
                data: {
                    orcidId: data?.orcidId || null,
                    indexH: openAlexData?.h_index || null,
                    indexI10: openAlexData?.i10_index || null,
                    openAlexId: openAlexData?.openAlexId.split("/").pop() || null,
                    imageUrl: `/static/${data.lattes}.webp`
                }
            });

            await saveResearcherProductions(tx, pesquisador.id, artigosEnriquecidos, livrosCapitulos);

            await tx.filaExtracaoPesquisador.upsert({
                where: { lattesId: data.lattes },
                update: {
                    status: FilaExtracaoStatus.CONCLUIDO,
                    processamentoIniciadoEm: null,
                    ultimoErroId: null,
                    ultimoErroEm: null,
                },
                create: {
                    lattesId: data.lattes,
                    nome: data.nome,
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
