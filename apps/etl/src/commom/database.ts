import { PrismaClient, prismaConfig } from '@oda/database';
import { normalizeString } from './normalize';
const prisma = new PrismaClient(prismaConfig);
export async function getOrCreateAreaConhecimentoHierarchy(tx: any, areaStr: string) {
    if (!areaStr) return null;
    const parts = areaStr.split(/[>;]/).map(p => p.trim()).filter(p => p.length > 0);
    let currentParentId: string | null = null;
    let leafArea = null;

    for (const part of parts) {
        const nomeNormalizado = normalizeString(part);
        let area = await tx.areaConhecimento.findUnique({
            where: { nomeNormalizado }
        });

        if (!area) {
            try {
                area = await tx.areaConhecimento.create({
                    data: {
                        nome: part,
                        nomeNormalizado,
                        areaPaiId: currentParentId
                    }
                });
            } catch (e) {
                area = await tx.areaConhecimento.findUnique({
                    where: { nomeNormalizado }
                });
            }
        } else if (currentParentId && area.areaPaiId !== currentParentId) {
            try {
                await tx.areaConhecimento.update({
                    where: { id: area.id },
                    data: { areaPaiId: currentParentId }
                });
            } catch (e) {}
        }
        if (area) {
            currentParentId = area.id;
            leafArea = area;
        }
    }
    return leafArea;
}

export async function insertInstituicao(data: { nome: string; uf: string; sigla: string }) {
    return await prisma.$transaction(async (tx) => {
        const estado = await tx.estado.findUniqueOrThrow({
            where: { sigla: data.uf }
        });

        let instituicao = await tx.instituicao.findFirst({
            where: { nome: data.nome }
        });

        if (!instituicao) {
            instituicao = await tx.instituicao.create({
                data: { 
                    nome: data.nome,
                    estadoId: estado.id,
                    sigla: data.sigla
                }
            });
        }

        return instituicao;
    });
} 

export async function createResearchers(data: { nome: string; lattesId: string; formacaoAcademica?: any; tipo?: any }) {
    return await prisma.$transaction(async (tx) => {
        await tx.filaExtracaoPesquisador.create({
            data: {
                nome: data.nome,
                lattesId: data.lattesId
            }
        });
        return await tx.pesquisador.create({
            data: {
                nome: data.nome,
                lattesId: data.lattesId,
                formacaoAcademica: data.formacaoAcademica || 'DOUTORADO',
                tipo: data.tipo || 'PESQUISADOR'
            }
        });
    });
}


/**
 * Cria ou recupera uma palavra-chave normalizada
 */
export async function upsertPalavraChave(tx: any, termo: string) {
    const termoNormalizado = normalizeString(termo);
    return await tx.palavraChave.upsert({
        where: { termoNormalizado },
        update: {},
        create: {
            termo: termo.trim(),
            termoNormalizado
        }
    });
}

/**
 * Cria ou recupera um setor de aplicação normalizado
 */
export async function upsertSetorAplicacao(tx: any, nome: string) {
    const nomeNormalizado = normalizeString(nome);
    return await tx.setorAplicacao.upsert({
        where: { nomeNormalizado },
        update: {},
        create: {
            nome: nome.trim(),
            nomeNormalizado
        }
    });
}

/**
 * Cria uma linha de pesquisa associando as palavras-chave e setores de aplicação
 */
export async function createLinhaPesquisa(
    tx: any, 
    grupoId: string, 
    titulo: string, 
    dgpId: string | null,
    objetivo: string | null, 
    palavras: string[], 
    setores: string[]
) {
    // 1. Cria ou atualiza a Linha de Pesquisa
    let linha;
    if (dgpId) {
        linha = await tx.linhaPesquisa.upsert({
            where: { dgpId },
            update: {
                titulo: titulo.trim(),
                objetivo: objetivo ? objetivo.trim() : null,
                grupoId
            },
            create: {
                dgpId,
                titulo: titulo.trim(),
                objetivo: objetivo ? objetivo.trim() : null,
                grupoId
            }
        });
    } else {
        linha = await tx.linhaPesquisa.create({
            data: {
                titulo: titulo.trim(),
                objetivo: objetivo ? objetivo.trim() : null,
                grupoId
            }
        });
    }

    const uniquePcIds = new Set<string>();
    for (const termo of palavras) {
        if (!termo.trim()) continue;
        const pc = await upsertPalavraChave(tx, termo);
        uniquePcIds.add(pc.id);
    }
    for (const pcId of uniquePcIds) {
        await tx.linhaPesquisaPalavraChave.upsert({
            where: {
                linhaPesquisaId_palavraChaveId: {
                    linhaPesquisaId: linha.id,
                    palavraChaveId: pcId
                }
            },
            update: {},
            create: {
                linhaPesquisaId: linha.id,
                palavraChaveId: pcId
            }
        });
    }

    // 3. Associa os Setores de Aplicação
    const uniqueSaIds = new Set<string>();
    for (const nome of setores) {
        if (!nome.trim()) continue;
        const sa = await upsertSetorAplicacao(tx, nome);
        uniqueSaIds.add(sa.id);
    }
    for (const saId of uniqueSaIds) {
        await tx.linhaPesquisaSetorAplicacao.upsert({
            where: {
                linhaPesquisaId_setorAplicacaoId: {
                    linhaPesquisaId: linha.id,
                    setorAplicacaoId: saId
                }
            },
            update: {},
            create: {
                linhaPesquisaId: linha.id,
                setorAplicacaoId: saId
            }
        });
    }

    return linha;
}