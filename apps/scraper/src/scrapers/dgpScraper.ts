import { PlaywrightCrawler, log } from 'crawlee';
import { Page } from 'playwright';
import { isDgpLoginRedirectError, readDgpPageContent } from '../common/dgpPageContent';
import { assertValidDgpIds, isValidDgpId } from '../common/dgpId';
import { DGP_TIMEOUTS } from '../common/config';
import { DGPExtractor } from '../parsers/dgpParser';
import { db, prisma } from '../common/database';
import { createCrawlerConfig, createCrawlerOptions, SCRAPER_SETTINGS, CRAWLER_STORAGE_DIRS, DGP_DATA_DIR, purgeCrawlerStorage, saveJson } from '../common/config';
import { memorySnapshot } from '../common/scraperMetrics';
import { DGP_DETAIL_SELECTORS, readDgpDetailButtons, resolveDgpDetailButton } from '../common/dgpDetailButtons';
import { FilaExtracaoStatus, TipoErroColeta, StatusSessao, StatusItemLog, TipoEntidadeLog, ModuloSistema, ModoExecucao, PipelineEtapa } from '@oda/database';
import { randomSleep, sleep } from '../common/utils';
import { SharedPipelineLogger } from '@oda/database';

const extractor = new DGPExtractor();
const pipelineLogger = new SharedPipelineLogger(prisma);

async function closePopup(popups: Set<Page>, page: Page) {
    for (const p of popups) {
        if (p !== page) {
            try {
                await p.close();
            } catch (e) {}
        }
    }
    popups.clear();
}

type DgpRecoveryStats = {
    tentativasRecuperacao: number;
    redirecionamentosLogin: number;
    tempoRecuperacaoMs: number;
    recuperacoesPorEtapa: Record<string, number>;
};

function createDgpRecoveryStats(): DgpRecoveryStats {
    return {
        tentativasRecuperacao: 0,
        redirecionamentosLogin: 0,
        tempoRecuperacaoMs: 0,
        recuperacoesPorEtapa: {},
    };
}

function isCnpqLoginUrl(url: string) {
    return url.includes('login.cnpq.br/auth/realms/cnpq')
        || url.includes('/faces/login.jsf');
}

async function safeCount(page: Page, selector: string) {
    try {
        return await page.locator(selector).count();
    } catch {
        return 0;
    }
}

async function ensureGroupMirrorReady(
    groupPage: Page,
    dgpId: string,
    detailSelector: string,
    etapa: PipelineEtapa,
    recoveryStats: DgpRecoveryStats,
) {
    const expectedPath = `/espelhogrupo/${dgpId}`;
    const currentUrl = groupPage.url();
    const isGroupMirror = currentUrl.includes(expectedPath);
    const humanResourcesCount = await safeCount(groupPage, '#recursosHumanos');
    const detailButtonsCount = await safeCount(groupPage, detailSelector);
    const hasHumanResources = humanResourcesCount > 0;
    const hasDetailButtons = detailButtonsCount > 0;

    if (isGroupMirror && hasHumanResources && hasDetailButtons) {
        return;
    }

    recoveryStats.tentativasRecuperacao += 1;
    recoveryStats.recuperacoesPorEtapa[etapa] = (recoveryStats.recuperacoesPorEtapa[etapa] || 0) + 1;

    const redirecionadoParaLogin = isCnpqLoginUrl(currentUrl);
    if (redirecionadoParaLogin) {
        recoveryStats.redirecionamentosLogin += 1;
    }

    if (recoveryStats.tentativasRecuperacao > SCRAPER_SETTINGS.dgp.maxRecoveriesPerGroup) {
        throw new Error(`Limite de recuperações do espelho DGP excedido para o grupo ${dgpId}. Tentativas: ${recoveryStats.tentativasRecuperacao}. Ultima URL: ${currentUrl}`);
    }

    const startedAt = performance.now();
    log.warning('[DGP] Página do grupo perdeu o estado esperado. Recarregando espelho antes de continuar.', {
        dgpId,
        etapa,
        tentativaRecuperacao: recoveryStats.tentativasRecuperacao,
        redirecionadoParaLogin,
        urlAtual: currentUrl,
        seletorDetalhe: detailSelector,
        recursosHumanosEncontrados: humanResourcesCount,
        botoesDetalheEncontrados: detailButtonsCount,
    });

    await groupPage.goto(`http://dgp.cnpq.br/dgp/espelhogrupo/${dgpId}`, {
        waitUntil: 'load',
        timeout: DGP_TIMEOUTS.mirrorMs,
    });
    await groupPage.waitForSelector('#recursosHumanos', { timeout: DGP_TIMEOUTS.mirrorMs });
    await groupPage.waitForSelector(detailSelector, { timeout: DGP_TIMEOUTS.mirrorMs });
    await randomSleep(500, 1000);

    const tempoMs = Math.round(performance.now() - startedAt);
    recoveryStats.tempoRecuperacaoMs += tempoMs;
    log.info('[DGP] Espelho do grupo recuperado.', {
        dgpId,
        etapa,
        tentativaRecuperacao: recoveryStats.tentativasRecuperacao,
        tempoMs,
    });
}

async function scrapeGroupPage(groupPage: Page, dgpId: string, recoveryStats: DgpRecoveryStats) {

    log.info(`[Scraper] Extraindo dados detalhados do Grupo ID: ${dgpId}`);

    const activePopups = new Set<Page>();
    const popupListener = (p: Page) => {
        activePopups.add(p);
        p.once('close', () => activePopups.delete(p));
    };
    groupPage.on('popup', popupListener);

    try {
        await groupPage.waitForSelector('#recursosHumanos', { timeout: DGP_TIMEOUTS.mirrorMs });
        await randomSleep(1000, 1500);
        const mainHtml = await readDgpPageContent(groupPage, '#recursosHumanos');
        const rhButtons = await readDgpDetailButtons(groupPage, DGP_DETAIL_SELECTORS.rh);
        const instButtons = await readDgpDetailButtons(groupPage, DGP_DETAIL_SELECTORS.institutions);
        const linesButtons = await readDgpDetailButtons(groupPage, DGP_DETAIL_SELECTORS.lines);

        // Cria map de detalhes do RH para cada pesquisador/líder do grupo
        const rhDetailsMap = new Map<string, ReturnType<typeof extractor.extractRHDetails>>();
        
        for (const item of rhButtons) {
            const nome = item.nome;

            await randomSleep(500, 1500);
            try {
                await ensureGroupMirrorReady(groupPage, dgpId, item.selector, PipelineEtapa.RH_DETALHES, recoveryStats);
                const btn = await resolveDgpDetailButton(groupPage, item);
                const [openedPopup] = await Promise.all([
                    groupPage.waitForEvent('popup', { timeout: DGP_TIMEOUTS.popupMs }),
                    btn.click({ timeout: DGP_TIMEOUTS.popupMs }),
                ]);
                const html = await readDgpPageContent(openedPopup, "tbody[id*='tblEspelhoRHGPAtuacao_data'], tbody[id*='tblEspelhoRHLPAtuacao_data']");
                // Extração dos pesquisadores do grupo de pesquisa
                rhDetailsMap.set(nome || 'Desconhecido', extractor.extractRHDetails(html));
                await openedPopup.close();
            } catch (err: any) {
                log.error(`[Scraper] Erro ao extrair detalhes do RH para ${nome}: ${err.message}`);
                err.message = `RH ${nome}: ${err.message}`;
                throw err;
            } finally {
                await closePopup(activePopups, groupPage);
            }
        }

        const instMap = new Map<string, ReturnType<typeof extractor.extractPartnerInstitutions>>();
        
        for (const item of instButtons) {
            await randomSleep(500, 1500);
            const instNome = item.nome;
            try {
                await ensureGroupMirrorReady(groupPage, dgpId, item.selector, PipelineEtapa.INSTITUICOES_PARCEIRAS, recoveryStats);
                const btn = await resolveDgpDetailButton(groupPage, item);
                const [openedPopup] = await Promise.all([
                    groupPage.waitForEvent('popup', { timeout: DGP_TIMEOUTS.popupMs }),
                    btn.click({ timeout: DGP_TIMEOUTS.popupMs }),
                ]);
                const html = await readDgpPageContent(openedPopup, "[id='idFormVisualizarParceira']");
                instMap.set(instNome || "Desconhecido", extractor.extractPartnerInstitutions(html));
                await openedPopup.close();
            } catch(err: any){
                console.error(`[Scraper] Erro ao extrair detalhes da instituição: ${err.message}`);
                err.message = `Instituicao ${instNome}: ${err.message}`;
                throw err;
            } finally {
                await closePopup(activePopups, groupPage);
            }
        }

          const linesMap = new Map<string, ReturnType<typeof extractor.extractLineDetails>>();
        
        for (const item of linesButtons) {
            await randomSleep(500, 1500);
            const linhaNome = item.nome;
            try {
                await ensureGroupMirrorReady(groupPage, dgpId, item.selector, PipelineEtapa.LINHA_PESQUISA, recoveryStats);
                const btn = await resolveDgpDetailButton(groupPage, item);
                const [openedPopup] = await Promise.all([
                    groupPage.waitForEvent('popup', { timeout: DGP_TIMEOUTS.popupMs }),
                    btn.click({ timeout: DGP_TIMEOUTS.popupMs }),
                ]);
                const html = await readDgpPageContent(openedPopup, '#linhaPesquisa');
                linesMap.set(linhaNome || "Desconhecido", extractor.extractLineDetails(html, linhaNome));
                await openedPopup.close();
            } catch(err: any){
                console.error(`[Scraper] Erro ao extrair detalhes da linha de pesquisa: ${err.message}`);
                err.message = `Linha ${linhaNome}: ${err.message}`;
                throw err;
            } finally {
                await closePopup(activePopups, groupPage);
            }
        }

        const data = extractor.extractGroupMirror(mainHtml, linesMap, rhDetailsMap, instMap);
        if (!data.nome || data.nome === 'N/A') throw new Error('Espelho do grupo sem nome valido.');
        
        data.idDgp = dgpId;
        const tamanhoTotalBytes = saveJson(data, DGP_DATA_DIR, dgpId);
        log.info(`Grupo ${dgpId} extraído e salvo com sucesso.`);

        // Filtra pesquisadores e líderes do grupo
        const pesquisadoresParaScrapear: string[] = [];

        // Insere na fila ou verifica se já está pendente
        for (const p of data.membros) {
            const row = await prisma.filaExtracaoPesquisador.findUnique({
                where: { lattesId: p.lattes }
            });

            if (!row) {
                await prisma.filaExtracaoPesquisador.create({
                    data: { lattesId: p.lattes, nome: p.nome, status: FilaExtracaoStatus.PENDENTE }
                });
                pesquisadoresParaScrapear.push(p.nome);
            } else if (row.status === FilaExtracaoStatus.PENDENTE) {
                pesquisadoresParaScrapear.push(p.nome);
            } else {
                log.info(`[Scraper] Pesquisador ${p.nome} (ID: ${p.lattes}) já foi processado ou está em andamento. Pulando...`);
            }
        }
        

        return {
            arquivosJsonGerados: 1,
            tamanhoTotalBytes,
            arquivoJson: `${dgpId}.json`,
            membrosExtraidos: Array.isArray(data.membros) ? data.membros.length : 0,
            linhasExtraidas: Array.isArray(data.linhas) ? data.linhas.length : 0,
            instituicoesExtraidas: Array.isArray(data.instituicoes) ? data.instituicoes.length : 0,
            pesquisadoresEnfileirados: pesquisadoresParaScrapear.length,
            dgpRecuperacoesEspelho: recoveryStats.tentativasRecuperacao,
            dgpRedirecionamentosLogin: recoveryStats.redirecionamentosLogin,
            dgpTempoRecuperacaoMs: recoveryStats.tempoRecuperacaoMs,
            dgpRecuperacoesPorEtapa: recoveryStats.recuperacoesPorEtapa,
        };

    } finally {
        groupPage.off('popup', popupListener);
        for (const p of activePopups) {
            if (p !== groupPage) {
                try {
                    await p.close();
                } catch (e) {}
            }
        }
        activePopups.clear();
    }
}

export async function runDgpScraper(dgpIds: string[] = []) {
    log.info('[Scraper] Iniciando Extração DGP a partir da fila (FilaExtracao)');

    let pendingGroups: { dgpId: string; nome: string }[] = [];

    if (dgpIds && dgpIds.length > 0) {
        assertValidDgpIds(dgpIds);
        for (const id of dgpIds) {
            const row = await prisma.filaExtracaoGrupo.upsert({
                where: { dgpId: id },
                update: {},
                create: {
                    dgpId: id,
                    nome: `Grupo_${id}`,
                    area: 'N/A',
                    instituicao: 'N/A',
                    status: FilaExtracaoStatus.PENDENTE
                }
            });
            pendingGroups.push({ dgpId: row.dgpId, nome: row.nome });
        }
    } else {
        const pending = await prisma.filaExtracaoGrupo.findMany({
            where: { status: FilaExtracaoStatus.PENDENTE },
            take: SCRAPER_SETTINGS.dgp.take,
            select: { dgpId: true, nome: true },
        });
        const invalid = pending.filter(group => !isValidDgpId(group.dgpId));
        if (invalid.length > 0) {
            log.warning('[DGP] Registros invalidos encontrados na fila e ignorados.', {
                ids: invalid.map(group => group.dgpId),
            });
        }
        pendingGroups = pending
            .filter(group => isValidDgpId(group.dgpId))
            .map(p => ({ dgpId: p.dgpId, nome: p.nome }));
    }

    if (pendingGroups.length === 0) {
        log.info('[Scraper] Nenhum grupo pendente na fila.');
        return;
    }

    log.info(`[Scraper] Encontrados ${pendingGroups.length} grupos pendentes. Iniciando extração...`);
    const crawlerConfig = createCrawlerConfig('dgp');
    log.info(`[Scraper] Storage Crawlee DGP: ${CRAWLER_STORAGE_DIRS.dgp}`);
    await purgeCrawlerStorage(crawlerConfig);

    const pipelineLogId = await pipelineLogger.startPipelineLogger(ModuloSistema.SCRAPER, null, ModoExecucao.APENAS_DGP, {
        comando: 'dgp-extract', itensFila: pendingGroups.length, gruposPendentes: pendingGroups.length,
    });
    const completed = new Set<string>();
    const started = new Map<string, number>();
    const recoveries = new Map<string, DgpRecoveryStats>();
    const totals = {
        gruposExtraidos: 0, itensComErro: 0, retries: 0, arquivosJsonGerados: 0,
        tamanhoTotalBytes: 0, membrosExtraidos: 0, linhasExtraidas: 0,
        instituicoesExtraidas: 0, pesquisadoresEnfileirados: 0,
    };
    const recordFailure = async (dgpId: string, error: Error, retries: number) => {
        if (completed.has(dgpId)) return;
        const item = await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.SCRAPE_GROUP_PAGE, StatusItemLog.ERRO, {
            entidadeId: dgpId, tipoEntidade: TipoEntidadeLog.GRUPO,
            tipoErro: TipoErroColeta.DESCONHECIDO,
            mensagemErro: error.message,
            detalhesErro: JSON.stringify({ stack: error.stack, retries, recuperacoes: recoveries.get(dgpId) }),
            tempoMs: Date.now() - (started.get(dgpId) ?? Date.now()),
        });
        await db.updateGroupQueueStatus(dgpId, FilaExtracaoStatus.ERRO, { ultimoErroId: item?.id });
        completed.add(dgpId);
        totals.itensComErro++;
        totals.retries += retries;
    };

    let fatalError: unknown;
    try {
    const crawler = new PlaywrightCrawler({
        ...createCrawlerOptions('dgp'),
        preNavigationHooks: [
            ...(createCrawlerOptions('dgp').preNavigationHooks ?? []),
            async ({ request }) => {
                const dgpId = request.userData.dgpId as string;
                if (!started.has(dgpId)) {
                    await db.updateGroupQueueStatus(dgpId, FilaExtracaoStatus.PROCESSANDO);
                    started.set(dgpId, Date.now());
                    recoveries.set(dgpId, createDgpRecoveryStats());
                }
            },
        ],
        async failedRequestHandler({ request }, error) {
            await recordFailure(request.userData.dgpId, error, request.retryCount);
        },

        async requestHandler({ page, request }) {
            const dgpId = request.userData.dgpId as string;
            if (completed.has(dgpId)) return;

            log.info(`\n🔍 Processando Grupo: ${dgpId}`);
            const startedAt = performance.now();
            
            try {
                const metadata = await scrapeGroupPage(page, dgpId, recoveries.get(dgpId)!);
                await db.updateGroupQueueStatus(dgpId, FilaExtracaoStatus.CONCLUIDO);
                await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.SCRAPE_GROUP_PAGE, StatusItemLog.SUCESSO, {
                    tipoEntidade: TipoEntidadeLog.GRUPO, entidadeId: dgpId,
                    tempoMs: Date.now() - started.get(dgpId)!,
                });
                completed.add(dgpId);
                totals.gruposExtraidos++;
                totals.retries += request.retryCount;
                for (const key of ['arquivosJsonGerados', 'tamanhoTotalBytes', 'membrosExtraidos', 'linhasExtraidas', 'instituicoesExtraidas', 'pesquisadoresEnfileirados'] as const) {
                    totals[key] += metadata[key];
                }
                log.info('[DGP] Grupo finalizado', { dgpId, tempoMs: Math.round(performance.now() - startedAt), retries: request.retryCount, ...memorySnapshot(), ...metadata });
            } catch (error: any) {
                log.warning('[DGP] Tentativa de coleta falhou.', { dgpId, tentativa: request.retryCount + 1, erro: error.message });
                const hasAnotherAttempt = request.retryCount < SCRAPER_SETTINGS.dgp.maxRequestRetries;
                if (hasAnotherAttempt && isDgpLoginRedirectError(error)) {
                    log.warning('[DGP] Login detectado. Aguardando 60 segundos antes de tentar o grupo novamente.', {
                        dgpId,
                        tentativa: request.retryCount + 1,
                    });
                    await sleep(SCRAPER_SETTINGS.dgp.loginRetryDelayMs);
                }
                throw error;
            }
        },
    }, crawlerConfig);

    const requests = pendingGroups.map(group => ({
        url: `http://dgp.cnpq.br/dgp/espelhogrupo/${group.dgpId}`,
        userData: { dgpId: group.dgpId, coletaId: `DGP-EXTRACT-${group.dgpId}` },
        uniqueKey: `DGP-EXTRACT-${group.dgpId}`
    }));

    await crawler.addRequests(requests);
    await crawler.run();
    } catch (error) {
        fatalError = error;
        for (const dgpId of started.keys()) {
            await recordFailure(dgpId, error instanceof Error ? error : new Error(String(error)), 0);
        }
        throw error;
    } finally {
        const recoveryTotals = createDgpRecoveryStats();
        for (const stats of recoveries.values()) {
            recoveryTotals.tentativasRecuperacao += stats.tentativasRecuperacao;
            recoveryTotals.redirecionamentosLogin += stats.redirecionamentosLogin;
            recoveryTotals.tempoRecuperacaoMs += stats.tempoRecuperacaoMs;
            for (const [etapa, count] of Object.entries(stats.recuperacoesPorEtapa)) {
                recoveryTotals.recuperacoesPorEtapa[etapa] = (recoveryTotals.recuperacoesPorEtapa[etapa] ?? 0) + count;
            }
        }
        await pipelineLogger.finishPipelineLogger(pipelineLogId, fatalError || totals.itensComErro ? StatusSessao.ERRO : StatusSessao.CONCLUIDO, {
            ...totals,
            gruposPendentes: pendingGroups.length - completed.size,
            dgpRecuperacoesEspelho: recoveryTotals.tentativasRecuperacao,
            dgpRedirecionamentosLogin: recoveryTotals.redirecionamentosLogin,
            dgpTempoRecuperacaoMs: recoveryTotals.tempoRecuperacaoMs,
            dgpRecuperacoesPorEtapa: recoveryTotals.recuperacoesPorEtapa,
        });
    }
    
    log.info('[Scraper] Extração DGP finalizada.', totals);

    log.info('[Scraper] Pesquisadores permanecem na fila para uma execucao separada do Lattes.');
}
