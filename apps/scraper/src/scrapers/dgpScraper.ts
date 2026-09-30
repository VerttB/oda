import { PlaywrightCrawler, log } from 'crawlee';
import { Page } from 'playwright';
import { isDgpLoginRedirectError, readDgpPageContent } from '../common/dgpPageContent';
import { assertValidDgpIds, isValidDgpId } from '../common/dgpId';
import { selectDgpRowsForScope } from '../common/dgpScope';
import { DGP_TIMEOUTS } from '../common/config';
import { DGPExtractor } from '../parsers/dgpParser';
import { db, prisma } from '../common/database';
import { createCrawlerConfig, createCrawlerOptions, SCRAPER_SETTINGS, CRAWLER_STORAGE_DIRS, getDgpDataDir, purgeCrawlerStorage, saveJson } from '../common/config';
import { memorySnapshot } from '../common/scraperMetrics';
import { DGP_DETAIL_SELECTORS, readDgpDetailButtons, resolveDgpDetailButton, type DgpDetailButton } from '../common/dgpDetailButtons';
import { FilaExtracaoStatus, TipoErroColeta, StatusSessao, StatusItemLog, TipoEntidadeLog, ModuloSistema, ModoExecucao, PipelineEtapa } from '@oda/database';
import { randomSleep, sleep } from '../common/utils';
import { SharedPipelineLogger } from '@oda/database';
import { isSimccInstitution, type DgpJobProgress } from '@oda/shared-types';
import type { DataScope } from '@oda/queue';

const extractor = new DGPExtractor();
const pipelineLogger = new SharedPipelineLogger(prisma);

export type DgpProgressUpdate = Omit<DgpJobProgress, 'progressoEm'>;
export type DgpProgressReporter = (progress: DgpProgressUpdate) => Promise<void>;

const noopProgress: DgpProgressReporter = async () => {};

function stagePercent(start: number, end: number, processed: number, total: number) {
    if (total === 0) return end;
    return Math.round(start + ((end - start) * processed) / total);
}

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
    tentativasDetalheLocal: number;
    detalhesRecuperadosLocalmente: number;
    tentativasDetalhePorEtapa: Record<string, number>;
};

function createDgpRecoveryStats(): DgpRecoveryStats {
    return {
        tentativasRecuperacao: 0,
        redirecionamentosLogin: 0,
        tempoRecuperacaoMs: 0,
        recuperacoesPorEtapa: {},
        tentativasDetalheLocal: 0,
        detalhesRecuperadosLocalmente: 0,
        tentativasDetalhePorEtapa: {},
    };
}

function isCnpqLoginUrl(url: string) {
    return url.includes('login.cnpq.br/auth/realms/cnpq')
        || url.includes('/faces/login.jsf');
}

function urlWithoutSessionParams(url: string) {
    try {
        const parsed = new URL(url);
        parsed.search = '';
        parsed.hash = '';
        return parsed.href;
    } catch {
        return '[URL invalida]';
    }
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
        throw new Error(`Limite de recuperações do espelho DGP excedido para o grupo ${dgpId}. Tentativas: ${recoveryStats.tentativasRecuperacao}. Ultima URL: ${urlWithoutSessionParams(currentUrl)}`);
    }

    const startedAt = performance.now();
    log.warning('[DGP] Página do grupo perdeu o estado esperado. Recarregando espelho antes de continuar.', {
        dgpId,
        etapa,
        tentativaRecuperacao: recoveryStats.tentativasRecuperacao,
        redirecionadoParaLogin,
        urlAtual: urlWithoutSessionParams(currentUrl),
        seletorDetalhe: detailSelector,
        recursosHumanosEncontrados: humanResourcesCount,
        botoesDetalheEncontrados: detailButtonsCount,
    });

    if (redirecionadoParaLogin) {
        log.warning('[DGP] Login detectado durante a recuperacao do espelho; aguardando antes de recarregar.', {
            dgpId,
            etapa,
            esperaMs: SCRAPER_SETTINGS.dgp.loginRetryDelayMs,
        });
        await sleep(SCRAPER_SETTINGS.dgp.loginRetryDelayMs);
    }

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

function isTransientDgpDetailError(error: unknown) {
    if (isDgpLoginRedirectError(error)) return false;
    const message = error instanceof Error ? error.message : String(error);
    return /Timeout .* exceeded|Execution context was destroyed|navigat(?:e|ing|ion)|Unable to retrieve content|Target page, context or browser has been closed|Documento DGP mudou|Nao foi possivel resolver botao DGP/i.test(message);
}

type DgpPopupDetailOptions<T> = {
    groupPage: Page;
    activePopups: Set<Page>;
    dgpId: string;
    item: DgpDetailButton;
    etapa: PipelineEtapa;
    expectedSelector: string;
    recoveryStats: DgpRecoveryStats;
    extract: (html: string) => T;
};

async function extractDgpPopupDetail<T>({
    groupPage,
    activePopups,
    dgpId,
    item,
    etapa,
    expectedSelector,
    recoveryStats,
    extract,
}: DgpPopupDetailOptions<T>): Promise<T> {
    const maxAttempts = SCRAPER_SETTINGS.dgp.detailMaxAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let openedPopup: Page | undefined;
        try {
            await ensureGroupMirrorReady(groupPage, dgpId, item.selector, etapa, recoveryStats);
            const button = await resolveDgpDetailButton(groupPage, item);
            [openedPopup] = await Promise.all([
                groupPage.waitForEvent('popup', { timeout: DGP_TIMEOUTS.popupMs }),
                button.click({ timeout: DGP_TIMEOUTS.popupMs }),
            ]);
            const html = await readDgpPageContent(openedPopup, expectedSelector);
            const result = extract(html);

            if (attempt > 1) {
                recoveryStats.detalhesRecuperadosLocalmente += 1;
                log.info('[DGP] Detalhe recuperado sem reiniciar o grupo.', {
                    dgpId,
                    etapa,
                    nome: item.nome || null,
                    tentativa: attempt,
                });
            }

            return result;
        } catch (error) {
            const canRetry = !groupPage.isClosed()
                && attempt < maxAttempts
                && isTransientDgpDetailError(error);
            if (!canRetry) throw error;

            if (openedPopup && !openedPopup.isClosed()) {
                try {
                    await openedPopup.close();
                } catch {}
                openedPopup = undefined;
            }
            await closePopup(activePopups, groupPage);

            recoveryStats.tentativasDetalheLocal += 1;
            recoveryStats.tentativasDetalhePorEtapa[etapa] = (recoveryStats.tentativasDetalhePorEtapa[etapa] || 0) + 1;
            log.warning('[DGP] Falha transitoria em detalhe; repetindo apenas o item atual.', {
                dgpId,
                etapa,
                nome: item.nome || null,
                tentativaConcluida: attempt,
                proximaTentativa: attempt + 1,
                esperaMs: SCRAPER_SETTINGS.dgp.detailRetryDelayMs,
                erro: error instanceof Error ? error.message : String(error),
            });
            await sleep(SCRAPER_SETTINGS.dgp.detailRetryDelayMs);
        } finally {
            if (openedPopup && !openedPopup.isClosed()) {
                try {
                    await openedPopup.close();
                } catch {}
            }
            await closePopup(activePopups, groupPage);
        }
    }

    throw new Error('Tentativas locais de detalhe DGP esgotadas.');
}

export async function scrapeGroupPage(
    groupPage: Page,
    dgpId: string,
    recoveryStats = createDgpRecoveryStats(),
    reportProgress: DgpProgressReporter = noopProgress,
    scope: DataScope = 'default',
) {

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
        await reportProgress({
            etapa: 'DADOS_GERAIS', percentual: 20,
            itensProcessados: null, itensTotal: null,
        });

        // Cria map de detalhes do RH para cada pesquisador/líder do grupo
        const rhDetailsMap = new Map<string, ReturnType<typeof extractor.extractRHDetails>>();

        await reportProgress({
            etapa: 'RECURSOS_HUMANOS', percentual: 20,
            itensProcessados: 0, itensTotal: rhButtons.length,
        });
        for (const [index, item] of rhButtons.entries()) {
            const nome = item.nome;

            await randomSleep(SCRAPER_SETTINGS.dgp.rhDelayMinMs, SCRAPER_SETTINGS.dgp.rhDelayMaxMs);
            const memberStartedAt = performance.now();
            try {
                const details = await extractDgpPopupDetail({
                    groupPage,
                    activePopups,
                    dgpId,
                    item,
                    etapa: PipelineEtapa.RH_DETALHES,
                    expectedSelector: "tbody[id*='tblEspelhoRHGPAtuacao_data'], tbody[id*='tblEspelhoRHLPAtuacao_data']",
                    recoveryStats,
                    extract: html => extractor.extractRHDetails(html),
                });
                rhDetailsMap.set(nome || 'Desconhecido', details);
                await reportProgress({
                    etapa: 'RECURSOS_HUMANOS',
                    percentual: stagePercent(20, 50, index + 1, rhButtons.length),
                    itensProcessados: index + 1,
                    itensTotal: rhButtons.length,
                });
            } catch (err: any) {
                const popup = [...activePopups].find(page => page !== groupPage && !page.isClosed());
                log.error('[DGP] Falha ao extrair detalhes do RH.', {
                    dgpId,
                    nome,
                    indice: index + 1,
                    total: rhButtons.length,
                    tempoMs: Math.round(performance.now() - memberStartedAt),
                    tipoErro: isDgpLoginRedirectError(err) ? 'LOGIN_REDIRECT' : 'EXTRACAO_RH',
                    urlGrupo: urlWithoutSessionParams(groupPage.url()),
                    urlPopup: popup ? urlWithoutSessionParams(popup.url()) : null,
                    erro: err instanceof Error ? err.message : String(err),
                });
                err.message = `RH ${nome}: ${err.message}`;
                throw err;
            } finally {
                await closePopup(activePopups, groupPage);
            }
        }

        const instMap = new Map<string, ReturnType<typeof extractor.extractPartnerInstitutions>>();

        await reportProgress({
            etapa: 'INSTITUICOES', percentual: 50,
            itensProcessados: 0, itensTotal: instButtons.length,
        });
        for (const [index, item] of instButtons.entries()) {
            await randomSleep(500, 1500);
            const instNome = item.nome;
            try {
                const details = await extractDgpPopupDetail({
                    groupPage,
                    activePopups,
                    dgpId,
                    item,
                    etapa: PipelineEtapa.INSTITUICOES_PARCEIRAS,
                    expectedSelector: "[id='idFormVisualizarParceira']",
                    recoveryStats,
                    extract: html => extractor.extractPartnerInstitutions(html),
                });
                instMap.set(instNome || 'Desconhecido', details);
                await reportProgress({
                    etapa: 'INSTITUICOES',
                    percentual: stagePercent(50, 65, index + 1, instButtons.length),
                    itensProcessados: index + 1,
                    itensTotal: instButtons.length,
                });
            } catch(err: any){
                console.error(`[Scraper] Erro ao extrair detalhes da instituição: ${err.message}`);
                err.message = `Instituicao ${instNome}: ${err.message}`;
                throw err;
            } finally {
                await closePopup(activePopups, groupPage);
            }
        }

        const linesMap = new Map<string, ReturnType<typeof extractor.extractLineDetails>>();

        await reportProgress({
            etapa: 'LINHAS_PESQUISA', percentual: 65,
            itensProcessados: 0, itensTotal: linesButtons.length,
        });
        for (const [index, item] of linesButtons.entries()) {
            await randomSleep(500, 1500);
            const linhaNome = item.nome;
            try {
                const details = await extractDgpPopupDetail({
                    groupPage,
                    activePopups,
                    dgpId,
                    item,
                    etapa: PipelineEtapa.LINHA_PESQUISA,
                    expectedSelector: '#linhaPesquisa',
                    recoveryStats,
                    extract: html => extractor.extractLineDetails(html, linhaNome),
                });
                linesMap.set(linhaNome || 'Desconhecido', details);
                await reportProgress({
                    etapa: 'LINHAS_PESQUISA',
                    percentual: stagePercent(65, 85, index + 1, linesButtons.length),
                    itensProcessados: index + 1,
                    itensTotal: linesButtons.length,
                });
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

        await reportProgress({
            etapa: 'SALVANDO_JSON', percentual: 90,
            itensProcessados: null, itensTotal: null,
        });
        data.idDgp = dgpId;
        const tamanhoTotalBytes = saveJson(data, getDgpDataDir(scope), dgpId);
        log.info(`Grupo ${dgpId} extraído e salvo com sucesso.`);

        // Filtra pesquisadores e líderes do grupo
        const pesquisadoresParaScrapear: string[] = [];

        if (scope === 'default') {
            // A coleta SIMCC termina no grupo; somente o fluxo geral alimenta o Lattes.
            await reportProgress({
                etapa: 'ENFILEIRANDO_PESQUISADORES', percentual: 92,
                itensProcessados: 0, itensTotal: data.membros.length,
            });
            for (const [index, p] of data.membros.entries()) {
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
                await reportProgress({
                    etapa: 'ENFILEIRANDO_PESQUISADORES',
                    percentual: stagePercent(92, 98, index + 1, data.membros.length),
                    itensProcessados: index + 1,
                    itensTotal: data.membros.length,
                });
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
            dgpTentativasDetalheLocal: recoveryStats.tentativasDetalheLocal,
            dgpDetalhesRecuperadosLocalmente: recoveryStats.detalhesRecuperadosLocalmente,
            dgpTentativasDetalhePorEtapa: recoveryStats.tentativasDetalhePorEtapa,
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

export async function runDgpScraper(dgpIds: string[] = [], scope: DataScope = 'default') {
    log.info('[Scraper] Iniciando Extração DGP a partir da fila (FilaExtracao)', { scope });

    let pendingGroups: { dgpId: string; nome: string }[] = [];

    if (dgpIds && dgpIds.length > 0) {
        assertValidDgpIds(dgpIds);
        for (const id of dgpIds) {
            const existing = await prisma.filaExtracaoGrupo.findUnique({ where: { dgpId: id } });
            if (scope === 'simcc' && (!existing || !isSimccInstitution(existing.instituicao))) {
                throw new Error(`O grupo ${id} nao possui uma instituicao SIMCC reconhecida na fila de descoberta.`);
            }
            const row = existing ?? await prisma.filaExtracaoGrupo.create({ data: {
                dgpId: id, nome: `Grupo_${id}`, area: 'N/A', instituicao: 'N/A', status: FilaExtracaoStatus.PENDENTE,
            } });
            pendingGroups.push({ dgpId: row.dgpId, nome: row.nome });
        }
    } else {
        const sourceRows = await prisma.filaExtracaoGrupo.findMany({
            where: scope === 'simcc' ? {} : { status: FilaExtracaoStatus.PENDENTE },
            select: { dgpId: true, nome: true, instituicao: true },
        });
        const invalid = sourceRows.filter(group => !isValidDgpId(group.dgpId));
        if (invalid.length > 0) {
            log.warning('[DGP] Registros invalidos encontrados na fila e ignorados.', {
                ids: invalid.map(group => group.dgpId),
            });
        }
        pendingGroups = selectDgpRowsForScope(sourceRows, scope, SCRAPER_SETTINGS.dgp.take)
            .map(p => ({ dgpId: p.dgpId, nome: p.nome }));
    }

    if (pendingGroups.length === 0) {
        log.info(scope === 'simcc'
            ? '[Scraper] Nenhum grupo SIMCC encontrado na fila.'
            : '[Scraper] Nenhum grupo pendente na fila.');
        return;
    }

    log.info(`[Scraper] Encontrados ${pendingGroups.length} grupos para coleta. Iniciando extração...`);
    const crawlerConfig = createCrawlerConfig('dgp');
    log.info(`[Scraper] Storage Crawlee DGP: ${CRAWLER_STORAGE_DIRS.dgp}`);
    await purgeCrawlerStorage(crawlerConfig);

    const pipelineLogId = await pipelineLogger.startPipelineLogger(ModuloSistema.SCRAPER, null, ModoExecucao.APENAS_DGP, {
        comando: 'dgp-extract', scope, itensFila: pendingGroups.length, gruposPendentes: pendingGroups.length,
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
                const metadata = await scrapeGroupPage(page, dgpId, recoveries.get(dgpId)!, noopProgress, scope);
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
            recoveryTotals.tentativasDetalheLocal += stats.tentativasDetalheLocal;
            recoveryTotals.detalhesRecuperadosLocalmente += stats.detalhesRecuperadosLocalmente;
            for (const [etapa, count] of Object.entries(stats.recuperacoesPorEtapa)) {
                recoveryTotals.recuperacoesPorEtapa[etapa] = (recoveryTotals.recuperacoesPorEtapa[etapa] ?? 0) + count;
            }
            for (const [etapa, count] of Object.entries(stats.tentativasDetalhePorEtapa)) {
                recoveryTotals.tentativasDetalhePorEtapa[etapa] = (recoveryTotals.tentativasDetalhePorEtapa[etapa] ?? 0) + count;
            }
        }
        await pipelineLogger.finishPipelineLogger(pipelineLogId, fatalError || totals.itensComErro ? StatusSessao.ERRO : StatusSessao.CONCLUIDO, {
            ...totals,
            scope,
            gruposPendentes: pendingGroups.length - completed.size,
            dgpRecuperacoesEspelho: recoveryTotals.tentativasRecuperacao,
            dgpRedirecionamentosLogin: recoveryTotals.redirecionamentosLogin,
            dgpTempoRecuperacaoMs: recoveryTotals.tempoRecuperacaoMs,
            dgpRecuperacoesPorEtapa: recoveryTotals.recuperacoesPorEtapa,
            dgpTentativasDetalheLocal: recoveryTotals.tentativasDetalheLocal,
            dgpDetalhesRecuperadosLocalmente: recoveryTotals.detalhesRecuperadosLocalmente,
            dgpTentativasDetalhePorEtapa: recoveryTotals.tentativasDetalhePorEtapa,
        });
    }
    
    log.info('[Scraper] Extração DGP finalizada.', totals);

    if (scope === 'default') {
        log.info('[Scraper] Pesquisadores permanecem na fila para uma execucao separada do Lattes.');
    } else {
        log.info('[Scraper] Coleta SIMCC encerrada sem publicar pesquisadores na fila Lattes.');
    }
}
