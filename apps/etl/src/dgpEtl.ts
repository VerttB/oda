import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient } from '@oda/database';
import { LATTES_DIR } from './commom/config';
import { runPesquisadorEtl } from './lattesEtl';

const prisma = new PrismaClient(prismaConfig);

/**
 * Lógica de persistência para Grupos de Pesquisa (DGP)
 */
export async function saveGroupToDb(data: any) {
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
    } catch (e: any) {
        console.error(`[ETL] ❌ Erro ao processar grupo ${dgpId}: ${e.message}`);
    }
}

/**
 * Executa o ETL de um grupo específico a partir do caminho do seu arquivo JSON.
 * Após concluir o grupo, dispara o ETL para todos os pesquisadores pertencentes ao grupo
 * caso os respectivos arquivos JSON existam na pasta do Lattes.
 */
export async function runGroupEtl(jsonPath: string) {
    console.log(`[ETL] 🔍 Iniciando processamento do arquivo de grupo: ${jsonPath}`);
    // Resolve o caminho de forma inteligente (tenta absoluto/relativo ao cwd, depois tenta relativo à raiz do monorepo)
    let resolvedPath = path.resolve(jsonPath);
    if (!fs.existsSync(resolvedPath)) {
        const monorepoRootPath = path.resolve(__dirname, '../../..', jsonPath);
        if (fs.existsSync(monorepoRootPath)) {
            resolvedPath = monorepoRootPath;
        } else {
            throw new Error(`Arquivo não encontrado no caminho especificado: ${jsonPath}`);
        }
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const groupData = JSON.parse(content);

    // 1. Processa e persiste o grupo no banco
    await saveGroupToDb(groupData);

    // 2. Dispara sequencialmente o ETL dos pesquisadores pertencentes a este grupo
    if (groupData.membros && Array.isArray(groupData.membros)) {
        const pesquisadores = groupData.membros.filter(
            (m: any) => m.lattes && (m.categoria_lattes === 'PESQUISADOR' || m.categoria_lattes === 'LIDER')
        );

        console.log(`[ETL] Encontrados ${pesquisadores.length} membros elegíveis (Pesquisador/Líder) no grupo.`);

        for (const membro of pesquisadores) {
            const lattesFileName = `${membro.nome.replace(/\s+/g, '_').toLowerCase()}.json`;
            const lattesFilePath = path.join(LATTES_DIR, lattesFileName);

            if (fs.existsSync(lattesFilePath)) {
                console.log(`[ETL] 👤 Iniciando ETL encadeado do pesquisador: ${membro.nome}`);
                await runPesquisadorEtl(lattesFilePath);
            } else {
                console.log(`[ETL] ⚠️ Arquivo Lattes para ${membro.nome} não encontrado em ${lattesFilePath}. Pulando.`);
            }
        }
    }
}
