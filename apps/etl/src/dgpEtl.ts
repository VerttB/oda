import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient, TipoPesquisador, FormacaoAcademica } from '@oda/database';
import { LATTES_DIR, PROCESSED_DATA_DIR } from './commom/config';
import { runPesquisadorEtl } from './lattesEtl';
import { createLinhaPesquisa, getOrCreateAreaConhecimentoHierarchy } from './commom/database';

const prisma = new PrismaClient(prismaConfig);

export async function saveGroupToDb(data: any) {
    const dgpId = data.idDgp;
    let grupoId = "";

    try {
        const grupo = await prisma.$transaction(async (tx) => {
            const instSigla = await tx.filaExtracaoGrupo.findFirst({where: { dgpId }})
            const instClean = data.instituicao.replace(instSigla, "").replace(/-\s*$/, "")
            let instName = instClean || "Instituição Desconhecida";
            let instituicao = await tx.instituicao.findFirst({
                where: { nome: { contains: instName, mode: 'insensitive' } }
            });

            if (!instituicao) {
                const filaGrupo = await tx.filaExtracaoGrupo.findFirst({ where: { dgpId } });
                const sigla = filaGrupo?.instituicao?.trim() || "INST";
                const estado = await tx.estado.findUnique({
                    where: { sigla: 'BA' }
                });
                instituicao = await tx.instituicao.create({
                    data: {
                        nome: instName.trim(),
                        sigla: sigla,
                        estadoId: estado?.id || null
                    }
                });
            }

            const anoStr = data.anoFormacao?.replace(/\D/g, '');
            const ano = anoStr ? parseInt(anoStr, 10) : null;

            const grupo = await tx.grupoPesquisa.upsert({
                where: { dgpId },
                update: {
                    nome: data.nome.trim(),
                    anoFormacao: ano,
                    areaPredominante: data.areaPredominante?.trim() || 'N/A',
                    repercussao: data.repercussao?.trim() || null,
                    unidade: data.unidade?.trim() || null,
                    email: data.email?.trim() || null,
                    telefone: data.telefone?.trim() || null,
                    website: data.website?.trim() || null,
                    logradouro: data.endereco?.logradouro?.trim() || null,
                    numero: data.endereco?.numero?.trim() || null,
                    complemento: data.endereco?.complemento?.trim() || null,
                    bairro: data.endereco?.bairro?.trim() || null,
                    cidade: data.endereco?.cidade?.trim() || data.endereco?.localidade?.trim() || null,
                    uf: data.endereco?.uf?.trim() || null,
                    cep: data.endereco?.cep?.trim() || null,
                    latitude: data.latitude ?? null,
                    longitude: data.longitude ?? null,
                    instituicaoId: instituicao.id,
                },
                create: {
                    dgpId,
                    nome: data.nome.trim(),
                    anoFormacao: ano,
                    areaPredominante: data.areaPredominante?.trim() || 'N/A',
                    repercussao: data.repercussao?.trim() || null,
                    unidade: data.unidade?.trim() || null,
                    email: data.email?.trim() || null,
                    telefone: data.telefone?.trim() || null,
                    website: data.website?.trim() || null,
                    logradouro: data.endereco?.logradouro?.trim() || null,
                    numero: data.endereco?.numero?.trim() || null,
                    complemento: data.endereco?.complemento?.trim() || null,
                    bairro: data.endereco?.bairro?.trim() || null,
                    cidade: data.endereco?.cidade?.trim() || data.endereco?.localidade?.trim() || null,
                    uf: data.endereco?.uf?.trim() || null,
                    cep: data.endereco?.cep?.trim() || null,
                    latitude: data.latitude ?? null,
                    longitude: data.longitude ?? null,
                    instituicaoId: instituicao.id,
                }
            });

            // Parse and link areaConhecimento
            const leafArea = await getOrCreateAreaConhecimentoHierarchy(tx, data.area || data.areaPredominante);
            if (leafArea) {
                await tx.grupoPesquisaAreaConhecimento.upsert({
                    where: {
                        grupoId_areaId: {
                            grupoId: grupo.id,
                            areaId: leafArea.id
                        }
                    },
                    update: {},
                    create: {
                        grupoId: grupo.id,
                        areaId: leafArea.id
                    }
                });
            }

            return grupo;
        }, { timeout: 10000 });

        grupoId = grupo.id;
        console.log(`[ETL] 🏢 Grupo "${grupo.nome}" (ID: ${grupoId}) inserido e confirmado.`);

        if (data.linhas && Array.isArray(data.linhas)) {
            await prisma.$transaction(async (tx) => {
                await tx.membroLinhaPesquisa.deleteMany({ where: { linhaPesquisa: { grupoId } } });
                await tx.linhaPesquisaPalavraChave.deleteMany({ where: { linhaPesquisa: { grupoId } } });
                await tx.linhaPesquisaSetorAplicacao.deleteMany({ where: { linhaPesquisa: { grupoId } } });
                await tx.linhaPesquisa.deleteMany({ where: { grupoId } });

                for (const linha of data.linhas) {
                    if (!linha.nome) continue;

                    const palavras = linha.palavrasChave || [];
                    const setores = linha.setoresAplicacao || [];

                    const novaLinha = await createLinhaPesquisa(
                        tx,
                        grupoId,
                        linha.nome.trim(),
                        linha.dgpId || null,
                        linha.objetivo?.trim() || null,
                        palavras,
                        setores
                    );

                    console.log(`[ETL] 🔬 Linha de Pesquisa criada -> ID: ${novaLinha.id} | Nome: "${novaLinha.titulo}"`);
                }
            }, { timeout: 15000 });
            console.log(`[ETL] ✅ Linhas de pesquisa inseridas e confirmadas.`);
        }

        if (data.membros && Array.isArray(data.membros)) {
            await prisma.$transaction(async (tx) => {
                for (const membro of data.membros) {
                    if (!membro.nome) continue;
                    const cleanLattes = membro.lattes && membro.lattes.trim().length > 0 ? membro.lattes.trim() : null;

                    const rawTipo = membro.categoriaLattes?.trim().toUpperCase();
                    const tipoMap: Record<string, TipoPesquisador> = {
                        'PESQUISADOR': TipoPesquisador.PESQUISADOR,
                        'LIDER': TipoPesquisador.PESQUISADOR,
                        'ESTUDANTE': TipoPesquisador.ESTUDANTE,
                        'TECNICO': TipoPesquisador.TECNICO,
                        'ESTRANGERO': TipoPesquisador.COLABORADOR_ESTRANGEIRO,
                        'ESTRANGEIRO': TipoPesquisador.COLABORADOR_ESTRANGEIRO,
                        'COLABORADOR_ESTRANGEIRO': TipoPesquisador.COLABORADOR_ESTRANGEIRO
                    };
                    const tipo = rawTipo ? (tipoMap[rawTipo] || null) : null;

                    const rawFormacao = membro.formacaoAcademica?.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
                    const formacaoMap: Record<string, FormacaoAcademica> = {
                        'GRADUACAO': FormacaoAcademica.GRADUACAO,
                        'ESPECIALIZACAO': FormacaoAcademica.ESPECIALIZACAO,
                        'MESTRADO': FormacaoAcademica.MESTRADO,
                        'DOUTORADO': FormacaoAcademica.DOUTORADO
                    };
                    const formacao = rawFormacao 
                        ? (formacaoMap[rawFormacao] || FormacaoAcademica.OUTRO) 
                        : null;

                    let pesquisador = null;
                    if (cleanLattes) {
                        pesquisador = await tx.pesquisador.findUnique({ where: { lattesId: cleanLattes } });
                    }
                    if (!pesquisador && membro.nome) {
                        pesquisador = await tx.pesquisador.findFirst({
                            where: { nome: { equals: membro.nome.trim(), mode: 'insensitive' } }
                        });
                    }

                    if (pesquisador) {
                        pesquisador = await tx.pesquisador.update({
                            where: { id: pesquisador.id },
                            data: {
                                ...(cleanLattes && !pesquisador.lattesId ? { lattesId: cleanLattes } : {}),
                                ...(formacao ? { formacaoAcademica: formacao } : {}),
                                ...(tipo ? { tipo } : {})
                            }
                        });
                    } else {
                        pesquisador = await tx.pesquisador.create({
                            data: {
                                nome: membro.nome.trim(),
                                lattesId: cleanLattes,
                                tipo: tipo,
                                formacaoAcademica: formacao
                            }
                        });
                    }

                    if (membro.areas && Array.isArray(membro.areas)) {
                        for (const areaStr of membro.areas) {
                            if (!areaStr.trim()) continue;
                            const leafArea = await getOrCreateAreaConhecimentoHierarchy(tx, areaStr);
                            if (leafArea) {
                                await tx.pesquisadoresAreaConhecimento.upsert({
                                    where: {
                                        pesquisadorId_areaId: {
                                            pesquisadorId: pesquisador.id,
                                            areaId: leafArea.id
                                        }
                                    },
                                    update: {},
                                    create: {
                                        pesquisadorId: pesquisador.id,
                                        areaId: leafArea.id
                                    }
                                });
                            }
                        }
                    }

                    if (membro.linhasAssociadas && Array.isArray(membro.linhasAssociadas)) {
                        for (const linhaTitulo of membro.linhasAssociadas) {
                            if (!linhaTitulo.trim()) continue;
                            const linha = await tx.linhaPesquisa.findFirst({
                                where: {
                                    grupoId: grupoId,
                                    titulo: { equals: linhaTitulo.trim(), mode: 'insensitive' }
                                }
                            });
                            if (linha) {
                                await tx.membroLinhaPesquisa.upsert({
                                    where: {
                                        linhaPesquisaId_pesquisadorId: {
                                            linhaPesquisaId: linha.id,
                                            pesquisadorId: pesquisador.id
                                        }
                                    },
                                    update: {},
                                    create: {
                                        linhaPesquisaId: linha.id,
                                        pesquisadorId: pesquisador.id
                                    }
                                });
                            }
                        }
                    }
                   
                    const isLider = membro.eLider === true;
                    await tx.membroGrupo.upsert({
                        where: {
                            pesquisadorId_grupoId: {
                                pesquisadorId: pesquisador.id,
                                grupoId: grupoId
                            }
                        },
                        update: { eLider: isLider },
                        create: {
                            pesquisadorId: pesquisador.id,
                            grupoId: grupoId,
                            eLider: isLider
                        }
                    });
                }
            }, { timeout: 15000 });
            console.log(`[ETL] 👥 Pesquisadores vinculados ao grupo.`);
        }

        console.log(`[ETL] ✅ Processamento do Grupo ${dgpId} concluído.`);
        await prisma.filaExtracaoGrupo.update({
            where: { dgpId },
            data: { status: 'CONCLUIDO' }
        });
    } catch (e: any) {
        console.error(`[ETL] ❌ Erro ao processar grupo ${dgpId}: ${e.message}`);
    }
}


export async function runGroupEtl(jsonPath: string) {
    console.log(`[ETL] 🔍 Iniciando processamento do arquivo de grupo: ${jsonPath}`);
    let resolvedPath = path.resolve(jsonPath);
    if (!fs.existsSync(resolvedPath)) {
        const monorepoRootPath = path.resolve(__dirname, '../../..', jsonPath);
        if (fs.existsSync(monorepoRootPath)) {
            resolvedPath = monorepoRootPath;
        } else {
            console.log(`[ETL] ⚠️ Arquivo de grupo não encontrado (pode ter sido processado concorrentemente): ${jsonPath}`);
            return;
        }
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const groupData = JSON.parse(content);

    await saveGroupToDb(groupData);

    if (groupData.membros && Array.isArray(groupData.membros)) {
       
        console.log(`[ETL] Encontrados ${groupData.membros.length} membros elegíveis (Pesquisador/Líder) no grupo.`);

        for (const membro of groupData.membros) {
            if (!membro.lattes) continue;
            const lattesFileName = `${membro.lattes.trim()}.json`;
            const lattesFilePath = path.join(LATTES_DIR, lattesFileName);
            if (fs.existsSync(lattesFilePath)) {
                console.log(`[ETL] 👤 Iniciando ETL encadeado do pesquisador: ${membro.nome}`);
                await runPesquisadorEtl(lattesFilePath);
            }
        }
    }

    const groupFileName = path.basename(resolvedPath);
    const processedDgpDir = path.join(PROCESSED_DATA_DIR, 'dgp');
    if (!fs.existsSync(processedDgpDir)) fs.mkdirSync(processedDgpDir, { recursive: true });
    const destGroupPath = path.join(processedDgpDir, groupFileName);
    if (resolvedPath !== destGroupPath) {
        try {
            if (fs.existsSync(resolvedPath)) {
                fs.renameSync(resolvedPath, destGroupPath);
                console.log(`[ETL] 📁 JSON Grupo ${groupFileName} movido para ${destGroupPath}`);
            } else {
                console.log(`[ETL] 📁 JSON Grupo ${groupFileName} já foi movido por outro processo.`);
            }
        } catch (renameError: any) {
            console.warn(`[ETL] ⚠️ Não foi possível mover o arquivo Grupo ${groupFileName}: ${renameError.message}`);
        }
    } else {
        console.log(`[ETL] 📁 JSON Grupo ${groupFileName} já está na pasta processed-data.`);
    }
}
