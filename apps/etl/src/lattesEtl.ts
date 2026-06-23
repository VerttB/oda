import * as fs from 'fs';
import { prismaConfig, PrismaClient } from '@oda/database';
import { OPEN_ALEX_URL, DOI_URL } from './commom/config';
const prisma = new PrismaClient(prismaConfig);

/**
 * Lógica de persistência para Currículos Lattes
 */

async function getOpenAlexData(nome: string, orcid?:string) {
    try{
        const params = orcid ? `filter=orcid:${orcid}` : `search.exact=${nome}` 
        const url = `${OPEN_ALEX_URL}?${params}`
        const res = await fetch(url)
        if (!res.ok || res.status == 404){ throw new Error(`Pesquisador(a) ${nome} não encontrado no openAlex`)}
        const data = await res.json()
        const { h_index, i10_index,id } = data.results[0]

        return { h_index, i10_index, openAlexId: id}
    }catch(e: unknown){
        if(e instanceof Error){
            console.log(`Ocorrou um erro ao procurar dados openAlex para ${nome} - ${e.message}`)
        }
    }
}

async function linkProductionDoi(doi: string) {
    try{
        const url = `${DOI_URL}${doi}`
        const res = await fetch(url)
        if (!res.ok || res.status == 404) throw new Error(`Artigo não encontrado na api do DOI`)
        
        const data = await res.json()  
        const { absctract } = data;
        return { absctract }
    }catch(e: unknown){
         if(e instanceof Error){
            console.log(`Ocorrou um erro ao informações para o doi: ${doi} - ${e.message}`)
        }
    }
}
import { TipoProducao } from '@oda/database';

async function linkProductionQualis(issn: string) {}


async function saveResearcherProductions(tx: any, pesquisadorId: string, artigos: any[], livrosCapitulos: any[]) {
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

        // Se não houver DOI, localiza por correspondência de Título + Ano para evitar duplicados
        if (!producao) {
            producao = await tx.producao.findFirst({
                where: {
                    titulo: { equals: artigo.titulo.trim(), mode: 'insensitive' },
                    ano: anoInt
                }
            });
        }

        if (!producao) {
            producao = await tx.producao.create({
                data: {
                    titulo: artigo.titulo.trim(),
                    ano: anoInt,
                    tipo: TipoProducao.ARTIGO,
                    doi: cleanDoi || null,
                    url: artigo.url || null,
                    veiculo: artigo.nomePeriodico || artigo.veiculo || null,
                    resumo: artigo.resumo || null
                }
            });
        } else {
            producao = await tx.producao.update({
                where: { id: producao.id },
                data: {
                    doi: cleanDoi || producao.doi,
                    veiculo: artigo.nomePeriodico || artigo.veiculo || producao.veiculo,
                    resumo: artigo.resumo || producao.resumo
                }
            });
        }

        // Associa o autor na tabela pivot
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

    // 2. Processa Livros e Capítulos
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

        // Associa o autor na tabela pivot
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

    const openAlexData = await getOpenAlexData(data.nome, data.orcid || data.orcidId);

    const artigosEnriquecidos = [] as any;
    if (data.artigos && Array.isArray(data.artigos)) {
        for (const artigo of data.artigos) {
            let resumo = null;
            if (artigo.doi) {
                const doiInfo = await linkProductionDoi(artigo.doi);
                if (doiInfo && doiInfo.absctract) {
                    resumo = doiInfo.absctract;
                }
            }
            artigosEnriquecidos.push({
                ...artigo,
                resumo
            });
        }
    }

    const livrosCapitulos = data.livrosCapitulos || [];

    try {
        await prisma.$transaction(async (tx) => {
            const pesquisador = await tx.pesquisador.findFirst({
                where: { nome: { contains: data.nome, mode: 'insensitive' } }
            });

            if (pesquisador) {
                // 2. Atualiza dados gerais do pesquisador
                await tx.pesquisador.update({
                    where: { id: pesquisador.id },
                    data: {
                        // Aqui você poderá atualizar campos novos de openAlex e orcid quando os adicionar ao banco
                    }
                });

                // 3. Persiste todas as produções e vincula a autoria de forma atômica
                await saveResearcherProductions(tx, pesquisador.id, artigosEnriquecidos, livrosCapitulos);

                console.log(`[ETL] ✅ Lattes e produções de ${data.nome} processados com sucesso.`);
            } else {
                console.log(`[ETL] ⚠️ Pesquisador ${data.nome} não encontrado no banco de dados relacional.`);
            }
        });
    } catch (error) {
        console.error(`[ETL] ❌ Erro no Lattes de ${data.nome}:`, error);
    }
}

/**
 * Executa o ETL de um pesquisador específico a partir do caminho do seu arquivo JSON.
 * (Preparado para alterações na função interna de salvamento saveLattesToDb)
 */
export async function runPesquisadorEtl(jsonPath: string) {
    console.log(`[ETL] 🔍 Iniciando processamento do arquivo de pesquisador: ${jsonPath}`);
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`Arquivo não encontrado no caminho especificado: ${jsonPath}`);
    }

    const content = fs.readFileSync(jsonPath, 'utf-8');
    const lattesData = JSON.parse(content);

    // 1. Processa e persiste o pesquisador no banco (saveLattesToDb)
    await saveLattesToDb(lattesData);
}
