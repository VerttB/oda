import { PrismaClient, prismaConfig } from '@oda/database';
import { DATA_DIR, DGP_DIR, LATTES_DIR } from '../commom/config';
const prisma = new PrismaClient(prismaConfig);

async function saveGroupToDb(data: any) {
    const dgpId = data.id_dgp;
    
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Instituição
            let instName = data.instituicao || "Instituição Desconhecida";
            let instituicao = await tx.instituicao.findFirst({
                where: { nome: { contains: instName, mode: 'insensitive' } }
            });

            if (!instituicao) {
                const estado = await tx.estado.findUnique({
                    where: { sigla: 'BA' }
                });
                instituicao = await tx.instituicao.create({
                    data: {
                        nome: instName,
                        sigla: instName.substring(0, 10).toUpperCase(),
                        estadoId: estado?.id || null
                    }
                });
            }

            // 2. Grupo
            const anoStr = data.ano_formacao?.replace(/\D/g, '');
            const ano = anoStr ? parseInt(anoStr, 10) : null;

            const grupo = await tx.grupoPesquisa.upsert({
                where: { dgpId },
                update: {
                    nome: data.nome,
                    anoFormacao: ano,
                    areaPredominante: data.area || 'N/A',
                    repercussao: data.repercussao || null,
                    instituicaoId: instituicao.id,
                },
                create: {
                    dgpId,
                    nome: data.nome,
                    anoFormacao: ano,
                    areaPredominante: data.area || 'N/A',
                    repercussao: data.repercussao || null,
                    instituicaoId: instituicao.id,
                }
            });

            // 3. Membros
            for (const membro of data.membros) {
                if (!membro.nome) continue;
                
                let pesquisador = null;
                if (membro.lattes) {
                    pesquisador = await tx.pesquisador.findUnique({ where: { lattesId: membro.lattes } });
                }

                if (!pesquisador) {
                    const existing = await tx.pesquisador.findFirst({ where: { nome: membro.nome } });
                    if (existing) {
                        pesquisador = existing;
                    } else {
                        pesquisador = await tx.pesquisador.create({
                            data: {
                                nome: membro.nome,
                                lattesId: membro.lattes || null,
                                tipo: 'PESQUISADOR',
                                formacaoAcademica: 'DOUTORADO'
                            }
                        });
                    }
                }

                await tx.membroGrupo.upsert({
                    where: {
                        pesquisadorId_grupoId: {
                            pesquisadorId: pesquisador.id,
                            grupoId: grupo.id
                        }
                    },
                    update: {},
                    create: {
                        pesquisadorId: pesquisador.id,
                        grupoId: grupo.id
                    }
                });
            }

            // 4. Linhas de Pesquisa
            await tx.membroLinhaPesquisa.deleteMany({ where: { linhaPesquisa: { grupoId: grupo.id } } });
            await tx.linhaPesquisaPalavraChave.deleteMany({ where: { linhaPesquisa: { grupoId: grupo.id } } });
            await tx.linhaPesquisaSetorAplicacao.deleteMany({ where: { linhaPesquisa: { grupoId: grupo.id } } });
            await tx.linhaPesquisa.deleteMany({ where: { grupoId: grupo.id } });

            for (const linha of data.linhas) {
                if (!linha.nome) continue;
                await tx.linhaPesquisa.create({
                    data: {
                        dgpId: linha.dgp_id || null,
                        titulo: linha.nome,
                        objetivo: linha.objetivo,
                        grupoId: grupo.id,
                    }
                });
            }
        });
        console.log(`[ETL] ✅ Grupo ${dgpId} processado.`);
    } catch (e: unknown) {
        if(e instanceof Error) console.error(`[ETL] ❌ Erro ao processar grupo ${dgpId}: ${e.message!}`);
    }
}