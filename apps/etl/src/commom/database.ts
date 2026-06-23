import { PrismaClient, prismaConfig } from '@oda/database';
const prisma = new PrismaClient(prismaConfig);

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
 * Cria ou recupera uma palavra-chave normalizada (em caixa alta)
 */
export async function upsertPalavraChave(tx: any, termo: string) {
    const termoNormalizado = termo.trim().toUpperCase();
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
 * Cria ou recupera um setor de aplicação normalizado (em caixa alta)
 */
export async function upsertSetorAplicacao(tx: any, nome: string) {
    const nomeNormalizado = nome.trim().toUpperCase();
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

    for (const termo of palavras) {
        if (!termo.trim()) continue;
        const pc = await upsertPalavraChave(tx, termo);
        await tx.linhaPesquisaPalavraChave.create({
            data: {
                linhaPesquisaId: linha.id,
                palavraChaveId: pc.id
            }
        });
    }

    // 3. Associa os Setores de Aplicação
    for (const nome of setores) {
        if (!nome.trim()) continue;
        const sa = await upsertSetorAplicacao(tx, nome);
        await tx.linhaPesquisaSetorAplicacao.create({
            data: {
                linhaPesquisaId: linha.id,
                setorAplicacaoId: sa.id
            }
        });
    }

    return linha;
}