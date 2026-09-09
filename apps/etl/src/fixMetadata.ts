import { prismaConfig, PrismaClient } from '@oda/database';
import { getOpenAlexData, linkProductionDoi, linkProductionQualis } from './lattesEtl';
import { stripHtml } from './commom/normalize';
import { PROCESSED_DATA_DIR } from './commom/config';
import * as fs from 'fs';
import * as path from 'path';
import { Qualis } from '@oda/database';

const prisma = new PrismaClient(prismaConfig);

export async function runFixMetadata(args: string[]) {
    let fixAllDoi = false;
    let specificDoi: string | null = null;
    let fixAllLattes = false;
    let specificLattes: string | null = null;
    let fixQualis = false;

    for (let i = 0; i < args.length; i++) {
        const flag = args[i];
        if (flag === '-doi') {
            fixAllDoi = true;
        } else if (flag === '-DOI') {
            specificDoi = args[i + 1];
            i++; 
        } else if (flag === '-lattes') {
            fixAllLattes = true;
        } else if (flag === '-LATTES') {
            specificLattes = args[i + 1];
            i++; 
        } else if (flag === '-qualis') {
            fixQualis = true;
        }
    }

    if (!fixAllDoi && !specificDoi && !fixAllLattes && !specificLattes && !fixQualis) {
        console.log('[FIX] Nenhuma flag informada.');
        console.log('Uso: pnpm etl fix [-doi] [-DOI <id/doi>] [-lattes] [-LATTES <lattesId/id>] [-qualis]');
        return;
    }

    if (fixAllDoi) {
        console.log('[FIX] Buscando todas as produções com DOI...');
        const producoes = await prisma.producao.findMany({
            where: { doi: { not: null } }
        });
        console.log(`[FIX] Encontradas ${producoes.length} produções para reprocessar.`);
        for (const prod of producoes) {
            if (prod.doi) {
                await fixSingleDoi(prod.id, prod.doi);
            }
        }
    } else if (specificDoi) {
        console.log(`[FIX] Buscando produção para DOI/ID: "${specificDoi}"...`);
        const prod = await prisma.producao.findFirst({
            where: {
                OR: [
                    { id: specificDoi },
                    { doi: specificDoi }
                ]
            }
        });
        if (prod && prod.doi) {
            await fixSingleDoi(prod.id, prod.doi);
        } else {
            console.error(`[FIX] Produção não encontrada para: "${specificDoi}"`);
        }
    }

    if (fixAllLattes) {
        console.log('[FIX] Buscando pesquisadores sem ID do OpenAlex...');
        const pesquisadores = await prisma.pesquisador.findMany({
            where: {
                NOT: {
                    orcidId:{
                        equals: null
                    }
                }
            }
        });
        console.log(`[FIX] Encontrados ${pesquisadores.length} pesquisadores para atualizar.`);
        for (const pesq of pesquisadores) {
            await fixSingleLattes(pesq.id, pesq.nome, pesq.orcidId || undefined);
        }
    } else if (specificLattes) {
        console.log(`[FIX] Buscando pesquisador para Lattes ID/UUID: "${specificLattes}"...`);
        const pesq = await prisma.pesquisador.findFirst({
            where: {
                OR: [
                    { id: specificLattes },
                    { lattesId: specificLattes }
                ]
            }
        });
        if (pesq) {
            await fixSingleLattes(pesq.id, pesq.nome, pesq.orcidId || undefined);
        } else {
            console.error(`[FIX] Pesquisador não encontrado para: "${specificLattes}"`);
        }
    }

    if (fixQualis) {
        await runFixQualis();
    }

    console.log('[FIX] Todos os reprocessamentos concluídos.');
}

async function fixSingleDoi(id: string, doi: string) {
    console.log(`[FIX] 🔍 Processando DOI: "${doi}"...`);
    const extra = await linkProductionDoi(doi);
    if (extra) {
        const { abstract, publisher, licenseUrl, issn } = extra;
        const cleanAbstract = abstract ? stripHtml(abstract) : null;
        const qualis = issn ? await linkProductionQualis(issn) : null;
        await prisma.producao.update({
            where: { id },
            data: {
                resumo: cleanAbstract || undefined,
                veiculo: publisher || undefined,
                url: licenseUrl || undefined,
                issn: issn || undefined,
                qualis: qualis || undefined,
            }
        });
        console.log(`[FIX] ✅ Produção com DOI "${doi}" updated.`);
    } else {
        console.log(`[FIX] ❌ Falha ao buscar dados para o DOI: "${doi}".`);
    }
}

async function fixSingleLattes(id: string, nome: string, orcid: string) {
    console.log(`[FIX] 🔍 Buscando OpenAlex para: "${nome}" (ORCID: ${orcid || 'N/A'})...`);
    const data = await getOpenAlexData(orcid);
    
    if (data) {
        console.log(data)
        await prisma.pesquisador.update({
            where: { id },
            data: {
                openAlexId: data.openAlexId || null,
                indexH: data.h_index || null,
                indexI10: data.i10_index || null
            }
        });
        console.log(`[FIX] ✅ Pesquisador "${nome}" atualizado.`);
    } else {
        console.log(`[FIX] ❌ Dados do OpenAlex não encontrados para: "${nome}".`);
    }
}

async function runFixQualis() {
    console.log('[QUALIS] 📡 Iniciando varredura nos JSONs do Lattes...');
    const lattesFolder = path.join(PROCESSED_DATA_DIR, 'lattes');
    if (!fs.existsSync(lattesFolder)) {
        console.error(`[QUALIS] ❌ Pasta não encontrada: ${lattesFolder}`);
        return;
    }

    const files = fs.readdirSync(lattesFolder).filter(f => f.endsWith('.json'));
    console.log(`[QUALIS] Encontrados ${files.length} arquivos JSON.`);

    let countUpdated = 0;

    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(lattesFolder, file), 'utf-8');
            const data = JSON.parse(raw);
            if (!data.artigos || !Array.isArray(data.artigos)) continue;

            for (const artigo of data.artigos) {
                const issn = artigo.issn || artigo.ISSN || null;
                if (!issn) continue;

                let producao = null;
                if (artigo.doi) {
                    producao = await prisma.producao.findUnique({
                        where: { doi: artigo.doi.trim() }
                    });
                }
                if (!producao && artigo.titulo) {
                    producao = await prisma.producao.findFirst({
                        where: { titulo: { equals: artigo.titulo.trim(), mode: 'insensitive' } }
                    });
                }

                if (producao) {
                    const qualis = await linkProductionQualis(issn);
                    await prisma.producao.update({
                        where: { id: producao.id },
                        data: { 
                            issn, 
                            qualis: qualis || null 
                        }
                    });
                    countUpdated++;
                }
            }
        } catch (e: any) {
            console.error(`[QUALIS] Erro ao processar arquivo ${file}: ${e.message}`);
        }
    }
    console.log(`[QUALIS] ✅ Sincronização de Qualis concluída. ${countUpdated} artigos atualizados.`);
}
