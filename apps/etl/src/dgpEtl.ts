import * as fs from 'fs';
import * as path from 'path';
import { prismaConfig, PrismaClient, TipoPesquisador, FormacaoAcademica, SharedPipelineLogger, ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog, TipoRelacaoGrupoInstituicao, PipelineEtapa } from '@oda/database';
import { EtlInputError, inspectEtlFile, moveEtlFileToProcessed } from './commom/etlFile';
import type { DataScope } from '@oda/queue';
import {
    createLinhaPesquisa,
    getLeafAreaName,
    getOrCreateAreaConhecimentoHierarchy,
    upsertGrupoAreaPrincipalDgp,
} from './commom/database';

const prisma = new PrismaClient(prismaConfig);

export type GroupEtlProgressUpdate = {
    etapa: 'LENDO_JSON' | 'VALIDANDO' | 'SALVANDO_GRUPO' | 'SALVANDO_LINHAS' | 'SALVANDO_PESQUISADORES' | 'MOVENDO_ARQUIVO' | 'CONCLUIDO';
    percentual: number;
    itensProcessados: number | null;
    itensTotal: number | null;
};
export type GroupEtlProgressReporter = (progress: GroupEtlProgressUpdate) => Promise<void>;

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

function isZeroDgpId(value: unknown): boolean {
    return typeof value === 'string' && /^0+$/.test(value.trim());
}

function resolveQueueDgpId(data: any, jsonPath: string): string {
    return data.id_dgp || data.idDgp || path.basename(jsonPath, '.json');
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

export async function saveGroupToDb(data: any, reportProgress: GroupEtlProgressReporter = async () => {}) {
    const dgpId = data.idDgp;
    let grupoId = "";

    try {
        await reportProgress({ etapa: 'SALVANDO_GRUPO', percentual: 20, itensProcessados: null, itensTotal: null });
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
            const anoStr = String(data.anoFormacao ?? '').replace(/\D/g, '');
            const ano = anoStr ? parseInt(anoStr, 10) : null;
            const areaHierarchy = data.area?.trim() || data.areaPredominante?.trim() || '';
            const areaSourceField = data.area?.trim() ? 'area' : 'areaPredominante';
            const areaPredominante = getLeafAreaName(areaHierarchy) || 'N/A';

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

            if (areaHierarchy) {
                await upsertGrupoAreaPrincipalDgp(tx, grupo.id, areaHierarchy, areaSourceField);
            }

            return grupo;
        }, { timeout: 60000 });

        grupoId = grupo.id;
        console.log(`[ETL] 🏢 Grupo "${grupo.nome}" (ID: ${grupoId}) inserido e confirmado.`);

        if (data.linhas && Array.isArray(data.linhas)) {
            await reportProgress({ etapa: 'SALVANDO_LINHAS', percentual: 45, itensProcessados: 0, itensTotal: data.linhas.length });
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
            await reportProgress({ etapa: 'SALVANDO_LINHAS', percentual: 55, itensProcessados: data.linhas.length, itensTotal: data.linhas.length });
            console.log(`[ETL] ✅ Linhas de pesquisa inseridas e confirmadas.`);
        }

        if (data.membros && Array.isArray(data.membros)) {
            await reportProgress({ etapa: 'SALVANDO_PESQUISADORES', percentual: 65, itensProcessados: 0, itensTotal: data.membros.length });
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

                    const pesquisadorAtual = await tx.pesquisador.findUniqueOrThrow({
                        where: { id: pesquisador.id },
                        select: { id: true }
                    });

                    const isLider = membro.eLider === true;
                    await tx.membroGrupo.upsert({
                        where: {
                            pesquisadorId_grupoId: {
                                pesquisadorId: pesquisadorAtual.id,
                                grupoId: grupoId
                            }
                        },
                        update: { eLider: isLider },
                        create: {
                            pesquisadorId: pesquisadorAtual.id,
                            grupoId: grupoId,
                            eLider: isLider
                        }
                    });

                    if (membro.areas && Array.isArray(membro.areas)) {
                        for (const areaStr of membro.areas) {
                            if (!areaStr.trim()) continue;
                            const leafArea = await getOrCreateAreaConhecimentoHierarchy(tx, areaStr);
                            if (leafArea) {
                                await tx.pesquisadoresAreaConhecimento.upsert({
                                    where: {
                                        pesquisadorId_areaId: {
                                            pesquisadorId: pesquisadorAtual.id,
                                            areaId: leafArea.id
                                        }
                                    },
                                    update: {},
                                    create: {
                                        pesquisadorId: pesquisadorAtual.id,
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
                                            pesquisadorId: pesquisadorAtual.id
                                        }
                                    },
                                    update: {},
                                    create: {
                                        linhaPesquisaId: linha.id,
                                        pesquisadorId: pesquisadorAtual.id
                                    }
                                });
                            }
                        }
                    }
                }
            }, { timeout: 60000 });
            await reportProgress({ etapa: 'SALVANDO_PESQUISADORES', percentual: 85, itensProcessados: data.membros.length, itensTotal: data.membros.length });
            console.log(`[ETL] 👥 Pesquisadores vinculados ao grupo.`);
        }

        console.log(`[ETL] ✅ Processamento do Grupo ${dgpId} concluído.`);
    } catch (e: any) {
        console.error(`[ETL] ❌ Erro ao processar grupo ${dgpId}: ${e.message}`);
        throw e;
    }
}


export type GroupEtlResult = {
    dgpId: string;
    arquivoJson: string;
    tamanhoBytes: number;
    membrosProcessados: number;
    linhasProcessadas: number;
    arquivoMovido: boolean;
};

export async function processGroupEtlFile(
    jsonPath: string,
    expectedDgpId?: string,
    reportProgress: GroupEtlProgressReporter = async () => {},
    scope: DataScope = 'default',
): Promise<GroupEtlResult> {
    await reportProgress({ etapa: 'LENDO_JSON', percentual: 5, itensProcessados: null, itensTotal: null });
    if (!fs.existsSync(jsonPath)) throw new Error(`Arquivo de grupo nao encontrado: ${jsonPath}`);

    const fileInfo = inspectEtlFile(jsonPath);
    let groupData: any;
    try {
        groupData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (error) {
        throw new EtlInputError(`JSON de grupo invalido: ${error instanceof Error ? error.message : String(error)}`);
    }

    await reportProgress({ etapa: 'VALIDANDO', percentual: 10, itensProcessados: null, itensTotal: null });
    const dgpId = resolveQueueDgpId(groupData, jsonPath);
    if (isZeroDgpId(groupData.idDgp)) {
        throw new EtlInputError(`JSON ignorado porque idDgp veio zerado; id_dgp informado: ${groupData.id_dgp || 'nenhum'}.`);
    }
    if (!/^\d{16}$/.test(dgpId)) throw new EtlInputError(`ID DGP invalido no JSON: ${dgpId || 'ausente'}.`);
    if (expectedDgpId && dgpId !== expectedDgpId) {
        throw new EtlInputError(`O JSON pertence ao grupo ${dgpId}, mas o job esperava ${expectedDgpId}.`);
    }
    groupData.idDgp = dgpId;

    await saveGroupToDb(groupData, reportProgress);
    await reportProgress({ etapa: 'MOVENDO_ARQUIVO', percentual: 95, itensProcessados: null, itensTotal: null });
    const arquivoMovido = moveEtlFileToProcessed(jsonPath, 'dgp', scope);
    const result = {
        dgpId,
        arquivoJson: fileInfo.arquivoJson,
        tamanhoBytes: fileInfo.tamanhoBytes,
        membrosProcessados: Array.isArray(groupData.membros) ? groupData.membros.length : 0,
        linhasProcessadas: Array.isArray(groupData.linhas) ? groupData.linhas.length : 0,
        arquivoMovido,
    };
    await reportProgress({ etapa: 'CONCLUIDO', percentual: 100, itensProcessados: null, itensTotal: null });
    return result;
}

export async function runGroupEtl(jsonPath: string, scope: DataScope = 'default') {
    const resolvedPath = path.resolve(jsonPath);
    const fileInfo = fs.existsSync(resolvedPath) ? inspectEtlFile(resolvedPath) : null;
    const dgpId = path.basename(jsonPath, '.json');
    const pipelineLogger = new SharedPipelineLogger(prisma);
    const pipelineLogId = await pipelineLogger.startPipelineLogger(
        ModuloSistema.ETL, /^\d{16}$/.test(dgpId) ? dgpId : null, ModoExecucao.APENAS_DGP,
        { comando: 'etl-grupo', scope, arquivoJson: path.basename(jsonPath), tamanhoTotalBytes: fileInfo?.tamanhoBytes },
    );
    const startedAt = performance.now();
    try {
        const result = await processGroupEtlFile(resolvedPath, undefined, async () => {}, scope);
        await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_GRUPO_CARGA, StatusItemLog.SUCESSO, {
            entidadeId: result.dgpId, tipoEntidade: TipoEntidadeLog.GRUPO,
            tempoMs: Math.round(performance.now() - startedAt),
        });
        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.CONCLUIDO, {
            scope,
            gruposGravados: 1,
            pesquisadoresAtualizados: result.membrosProcessados,
            linhasPesquisaGravadas: result.linhasProcessadas,
            arquivoJson: result.arquivoJson,
            tamanhoTotalBytes: result.tamanhoBytes,
        });
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_GRUPO_CARGA, StatusItemLog.ERRO, {
            entidadeId: /^\d{16}$/.test(dgpId) ? dgpId : path.basename(jsonPath),
            tipoEntidade: TipoEntidadeLog.GRUPO,
            tipoErro: TipoErroColeta.FALHA_ETL,
            mensagemErro: message,
            detalhesErro: error instanceof Error ? error.stack : undefined,
            tempoMs: Math.round(performance.now() - startedAt),
        });
        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.ERRO, { scope, gruposGravados: 0, arquivoJson: path.basename(jsonPath) });
        throw error;
    }
}
