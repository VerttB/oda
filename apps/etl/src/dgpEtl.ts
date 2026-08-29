import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient, TipoPesquisador, FormacaoAcademica, SharedPipelineLogger, ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog, TipoRelacaoGrupoInstituicao, FilaExtracaoStatus, PipelineEtapa } from '@oda/database';
import { LATTES_DIR, PROCESSED_DATA_DIR } from './commom/config';
import { runPesquisadorEtl } from './lattesEtl';
import { createLinhaPesquisa, getOrCreateAreaConhecimentoHierarchy } from './commom/database';

const prisma = new PrismaClient(prismaConfig);

type GrupoInstituicaoInput = {
    nome: string;
    sigla?: string | null;
    uf?: string | null;
    tipoRelacao: TipoRelacaoGrupoInstituicao;
    unidade?: string | null;
    unidadeUf?: string | null;
};

type GrupoInstituicaoRawInput = Omit<Partial<GrupoInstituicaoInput>, 'unidade'> & {
    nome?: string | null;
    unidade?: string | { nome?: unknown; uf?: unknown } | null;
};

function cleanOptional(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    return clean.length > 0 ? clean : null;
}

function normalizeUf(value: unknown): string | null {
    const clean = cleanOptional(value);
    return clean ? clean.toUpperCase() : null;
}

function getUnidadeNome(value: unknown): string | null {
    if (typeof value === 'string') return cleanOptional(value);
    if (!value || typeof value !== 'object') return null;

    return cleanOptional((value as { nome?: unknown }).nome);
}

function getUnidadeUf(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    return normalizeUf((value as { uf?: unknown }).uf);
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitInstitutionNameAndSigla(rawName: string, fallbackSigla?: string | null) {
    const trimmedName = rawName.trim();
    const dashMatch = trimmedName.match(/\s+-\s+([A-Z0-9 .]{2,20})$/);
    const parenMatch = trimmedName.match(/\(([A-Z0-9 .]{2,20})\)$/);
    const sigla = cleanOptional(fallbackSigla) ?? dashMatch?.[1]?.trim() ?? parenMatch?.[1]?.trim() ?? null;
    const nome = sigla
        ? trimmedName
            .replace(new RegExp(`\\s+-\\s+${escapeRegex(sigla)}$`), '')
            .replace(new RegExp(`\\s*\\(${escapeRegex(sigla)}\\)$`), '')
            .trim()
        : trimmedName;

    return {
        nome: nome || trimmedName || 'Instituição Desconhecida',
        sigla: sigla || 'INST',
    };
}

function normalizeInstitutionRelation(value: unknown): TipoRelacaoGrupoInstituicao {
    return value === TipoRelacaoGrupoInstituicao.SEDE || value === 'SEDE'
        ? TipoRelacaoGrupoInstituicao.SEDE
        : TipoRelacaoGrupoInstituicao.PARCEIRA;
}

function buildGrupoInstituicoes(data: any, filaInstituicao?: string | null): GrupoInstituicaoInput[] {
    const instituicoes = new Map<string, GrupoInstituicaoInput>();

    const addInstituicao = (input: GrupoInstituicaoRawInput) => {
        const nome = cleanOptional(input.nome);
        if (!nome) return;

        const parsed = splitInstitutionNameAndSigla(nome, input.sigla);
        const key = `${parsed.nome.toLowerCase()}|${parsed.sigla.toLowerCase()}`;
        const current = instituicoes.get(key);
        const tipoRelacao = input.tipoRelacao ?? TipoRelacaoGrupoInstituicao.PARCEIRA;
        const unidadeNome = getUnidadeNome(input.unidade);
        const unidadeUf = normalizeUf(input.unidadeUf) ?? getUnidadeUf(input.unidade);

        instituicoes.set(key, {
            nome: parsed.nome,
            sigla: parsed.sigla,
            tipoRelacao: current?.tipoRelacao === TipoRelacaoGrupoInstituicao.SEDE
                ? TipoRelacaoGrupoInstituicao.SEDE
                : tipoRelacao,
            uf: normalizeUf(input.uf) ?? current?.uf ?? null,
            unidade: unidadeNome ?? current?.unidade ?? null,
            unidadeUf: unidadeUf ?? current?.unidadeUf ?? null,
        });
    };

    addInstituicao({
        nome: data.instituicao,
        sigla: filaInstituicao,
        uf: data.endereco?.uf,
        tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE,
        unidade: data.unidade,
    });

    if (Array.isArray(data.instituicoes)) {
        for (const instituicao of data.instituicoes) {
            addInstituicao({
                nome: instituicao.nome ?? instituicao.instituicao,
                sigla: instituicao.sigla,
                uf: instituicao.uf,
                tipoRelacao: normalizeInstitutionRelation(instituicao.tipoRelacao ?? instituicao.relacao),
                unidade: instituicao.unidade,
            });
        }
    }

    return Array.from(instituicoes.values());
}

async function getOrCreateInstituicao(tx: any, input: GrupoInstituicaoInput, estadoId?: string | null) {
    let instituicao = await tx.instituicao.findFirst({
        where: { nome: { equals: input.nome, mode: 'insensitive' } }
    });

    if (!instituicao && input.sigla && input.sigla !== 'INST') {
        instituicao = await tx.instituicao.findFirst({
            where: { sigla: { equals: input.sigla, mode: 'insensitive' } }
        });
    }

    if (!instituicao) {
        instituicao = await tx.instituicao.create({
            data: {
                nome: input.nome,
                sigla: input.sigla || 'INST',
                estadoId: estadoId || null
            }
        });
    }

    return instituicao;
}

async function getEstadoIdByUf(tx: any, uf?: string | null, fallbackEstadoId?: string | null) {
    const cleanUf = normalizeUf(uf);
    if (!cleanUf) return fallbackEstadoId ?? null;

    const estado = await tx.estado.findUnique({
        where: { sigla: cleanUf }
    });

    return estado?.id ?? fallbackEstadoId ?? null;
}

export async function saveGroupToDb(data: any) {
    const dgpId = data.idDgp;
    let grupoId = "";

    try {
        const grupo = await prisma.$transaction(async (tx) => {
            const filaGrupo = await tx.filaExtracaoGrupo.findFirst({ where: { dgpId } });
            const estado = await tx.estado.findUnique({
                where: { sigla: data.endereco?.uf?.trim() || 'BA' }
            });
            const instituicoesGrupo = buildGrupoInstituicoes(data, filaGrupo?.instituicao);
            const sedeInput = instituicoesGrupo.find((item) => item.tipoRelacao === TipoRelacaoGrupoInstituicao.SEDE)
                ?? instituicoesGrupo[0]
                ?? {
                    nome: 'Instituicao Desconhecida',
                    sigla: 'INST',
                    tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE,
                    unidade: null,
                    unidadeUf: null,
                };
            const instituicao = await getOrCreateInstituicao(tx, sedeInput, estado?.id);
            const anoStr = data.anoFormacao?.replace(/\D/g, '');
            const ano = anoStr ? parseInt(anoStr, 10) : null;
            const areaPredominante = data.areaPredominante?.trim() || data.area?.trim() || 'N/A';

            const grupo = await tx.grupoPesquisa.upsert({
                where: { dgpId },
                update: {
                    nome: data.nome.trim(),
                    anoFormacao: ano,
                    areaPredominante,
                    repercussao: data.repercussao?.trim() || null,
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
                },
                create: {
                    dgpId,
                    nome: data.nome.trim(),
                    anoFormacao: ano,
                    areaPredominante,
                    repercussao: data.repercussao?.trim() || null,
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
                }
            });

            for (const item of instituicoesGrupo) {
                const estadoVinculoId = await getEstadoIdByUf(tx, item.uf, estado?.id);
                const instituicaoVinculo = item.tipoRelacao === TipoRelacaoGrupoInstituicao.SEDE
                    ? instituicao
                    : await getOrCreateInstituicao(tx, item, estadoVinculoId);

                await tx.grupoPesquisaInstituicao.upsert({
                    where: {
                        grupoId_instituicaoId: {
                            grupoId: grupo.id,
                            instituicaoId: instituicaoVinculo.id,
                        },
                    },
                    update: {
                        tipoRelacao: item.tipoRelacao,
                        unidade: item.unidade || null,
                        unidadeUf: item.unidadeUf || null,
                    },
                    create: {
                        grupoId: grupo.id,
                        instituicaoId: instituicaoVinculo.id,
                        tipoRelacao: item.tipoRelacao,
                        unidade: item.unidade || null,
                        unidadeUf: item.unidadeUf || null,
                    },
                });
            }

            // Parse and link areaConhecimento
            const leafArea = await getOrCreateAreaConhecimentoHierarchy(tx, data.area || areaPredominante);
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
        }, { timeout: 60000 });

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
            }, { timeout: 60000 });
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
            }, { timeout: 60000 });
            console.log(`[ETL] 👥 Pesquisadores vinculados ao grupo.`);
        }

        console.log(`[ETL] ✅ Processamento do Grupo ${dgpId} concluído.`);
        await prisma.filaExtracaoGrupo.update({
            where: { dgpId },
            data: {
                status: FilaExtracaoStatus.CONCLUIDO,
                processamentoIniciadoEm: null,
                ultimoErroId: null,
                ultimoErroEm: null,
            }
        });
    } catch (e: any) {
        console.error(`[ETL] ❌ Erro ao processar grupo ${dgpId}: ${e.message}`);
        throw e;
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
    const dgpId = groupData.idDgp || groupData.id_dgp || path.basename(jsonPath, '.json');
    const groupFileStats = fs.statSync(resolvedPath);

    const pipelineLogger = new SharedPipelineLogger(prisma);
    const pipelineLogId = await pipelineLogger.startPipelineLogger(
        ModuloSistema.ETL,
        dgpId,
        ModoExecucao.COMPLETA,
        {
            comando: 'etl-grupo',
            arquivoJson: path.basename(resolvedPath),
            tamanhoTotalBytes: groupFileStats.size,
            membrosEncontrados: Array.isArray(groupData.membros) ? groupData.membros.length : 0,
            linhasPesquisaEncontradas: Array.isArray(groupData.linhas) ? groupData.linhas.length : 0,
        }
    );

    let pesquisadoresAtualizados = 0;
    let linhasPesquisaGravadas = groupData.linhas && Array.isArray(groupData.linhas) ? groupData.linhas.length : 0;

    const t0 = performance.now();
    try {
        await saveGroupToDb(groupData);
        const tempoGroupMs = Math.round(performance.now() - t0);

        const groupFileName = path.basename(resolvedPath);
        const processedDgpDir = path.join(PROCESSED_DATA_DIR, 'dgp');
        if (!fs.existsSync(processedDgpDir)) fs.mkdirSync(processedDgpDir, { recursive: true });
        const destGroupPath = path.join(processedDgpDir, groupFileName);
        if (resolvedPath !== destGroupPath) {
            try {
                if (fs.existsSync(resolvedPath)) {
                    fs.renameSync(resolvedPath, destGroupPath);
                    console.log(`[ETL] 📁 JSON Grupo ${groupFileName} movido para ${destGroupPath}`);
                }
            } catch (renameError: any) {
                console.warn(`[ETL] ⚠️ Não foi possível mover o arquivo Grupo ${groupFileName}: ${renameError.message}`);
            }
        }

        await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_GRUPO_CARGA, StatusItemLog.SUCESSO, {
            entidadeId: dgpId,
            tipoEntidade: TipoEntidadeLog.GRUPO,
            tempoMs: tempoGroupMs,
        });
    } catch (err: any) {
        console.error(`[ETL] ❌ Erro na carga do grupo ${dgpId}: ${err.message}`);
        const errorItem = await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_GRUPO_CARGA, StatusItemLog.ERRO, {
            entidadeId: dgpId,
            tipoEntidade: TipoEntidadeLog.GRUPO,
            tipoErro: TipoErroColeta.FALHA_ETL,
            mensagemErro: err.message,
            detalhesErro: err.stack,
        });
        await prisma.filaExtracaoGrupo.update({
            where: { dgpId },
            data: {
                status: FilaExtracaoStatus.ERRO,
                processamentoIniciadoEm: null,
                ultimoErroId: errorItem?.id ?? null,
                ultimoErroEm: new Date(),
            }
        }).catch(() => undefined);
    }

    if (groupData.membros && Array.isArray(groupData.membros)) {
        console.log(`[ETL] Encontrados ${groupData.membros.length} membros elegíveis (Pesquisador/Líder) no grupo.`);

        for (const membro of groupData.membros) {
            if (!membro.lattes) continue;
            const lattesFileName = `${membro.lattes.trim()}.json`;
            const lattesFilePath = path.join(LATTES_DIR, lattesFileName);
            if (fs.existsSync(lattesFilePath)) {
                console.log(`[ETL] 👤 Iniciando ETL encadeado do pesquisador: ${membro.nome}`);
                const tMembro = performance.now();
                try {
                    await runPesquisadorEtl(lattesFilePath);
                    const tempoMembroMs = Math.round(performance.now() - tMembro);
                    pesquisadoresAtualizados++;

                    await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.SUCESSO, {
                        entidadeId: membro.lattes.trim(),
                        tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                        tempoMs: tempoMembroMs,
                    });
                } catch (mErr: any) {
                    await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.ERRO, {
                        entidadeId: membro.lattes.trim(),
                        tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                        tipoErro: TipoErroColeta.FALHA_ETL,
                        mensagemErro: mErr.message,
                        detalhesErro: mErr.stack,
                    });
                }
            }
        }
    }

    const finalStatus = await prisma.pipelineLog.findUnique({
        where: { id: pipelineLogId ?? '' },
        select: { quantidadeErros: true },
    }).catch(() => null);

    await pipelineLogger.finishPipelineLogger(
        pipelineLogId,
        finalStatus && finalStatus.quantidadeErros > 0 ? StatusSessao.ERRO : StatusSessao.CONCLUIDO,
        {
        gruposGravados: 1,
        pesquisadoresAtualizados,
        linhasPesquisaGravadas,
        membrosEncontrados: Array.isArray(groupData.membros) ? groupData.membros.length : 0,
        linhasPesquisaEncontradas: Array.isArray(groupData.linhas) ? groupData.linhas.length : 0,
        }
    );
}
