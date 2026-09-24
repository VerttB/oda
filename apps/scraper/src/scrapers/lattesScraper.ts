import { PlaywrightCrawler, log } from 'crawlee';
import { Page } from 'playwright';
import { LattesParser } from '../parsers/lattesParser';
import { createCrawlerConfig, createCrawlerOptions, SCRAPER_SETTINGS, LATTES_URL, CRAWLER_STORAGE_DIRS, IMAGE_DIR, LATTES_DATA_DIR, purgeCrawlerStorage, saveJson } from '../common/config';
import { memorySnapshot } from '../common/scraperMetrics';
import { prisma, db } from '../common/database';
import { FilaExtracaoStatus, TipoErroColeta, StatusSessao, StatusItemLog, TipoEntidadeLog, ModuloSistema, ModoExecucao, SharedPipelineLogger, PipelineEtapa } from '@oda/database';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { captureLattesSearchFailure, submitLattesSearch } from '../common/lattesSearchNavigation';
import { randomUUID } from 'node:crypto';

const parser = new LattesParser();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeName(n: string): string {
    return n.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

async function getPaginationStatus(page: Page) {
    try {
        return await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            const targetScript = scripts.find(s => s.textContent && s.textContent.includes('intLTotReg'));
            if (!targetScript?.textContent) {
                const resultsCount = document.querySelectorAll('.resultado ol li').length;
                const summaryText = Array.from(document.querySelectorAll('.tit_form'))
                    .map(element => (element.textContent || '').replace(/\s+/g, ' ').trim())
                    .find(text => /Resultados?\s+de/i.test(text)) || '';
                const summary = summaryText.match(/Resultados?\s+de\s+(\d+)\s*-\s*(\d+)\s+(?:de|dos?)\s+(\d+)/i);
                if (!summary) return null;

                const firstResult = Number(summary[1]);
                const lastResult = Number(summary[2]);
                const totalRecords = Number(summary[3]);
                const displayedRecords = lastResult - firstResult + 1;

                if (firstResult !== 1
                    || displayedRecords !== resultsCount
                    || totalRecords !== resultsCount) return null;

                return {
                    totalRecords,
                    recordsPerPage: Math.max(resultsCount, 1),
                    currentPage: 1,
                };
            }

            const totalRecordsText = targetScript.textContent.match(/var\s+intLTotReg\s*=\s*(\d+)/)?.[1];
            const recordsPerPageText = targetScript.textContent.match(/var\s+intLRegPagina\s*=\s*(\d+)/)?.[1];
            if (!totalRecordsText || !recordsPerPageText) return null;
            const totalRecords = Number(totalRecordsText);
            const recordsPerPage = Number(recordsPerPageText);
            const currentPageText = document.querySelector('a[data-role="paginacao"] font[color="#ff0000"]')?.textContent
                || document.querySelector('a[data-role="paginacao"].is-current')?.textContent;
            const currentPage = currentPageText ? Number.parseInt(currentPageText, 10) || null : null;

            return recordsPerPage > 0 ? { totalRecords, recordsPerPage, currentPage } : null;
        });
    } catch {
        return null;
    }
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

async function downloadProfileImage(page: Page, lattesId: string): Promise<boolean> {
    try {
        const imgElement = page.locator('img.foto').first();
        if (await imgElement.count()) {
            const src = await imgElement.getAttribute('src');
            if (src) {
                const absoluteUrl = new URL(src, page.url()).href;
                const response = await page.request.get(absoluteUrl, { timeout: 15000 });
                try {
                    if (response.ok()) {
                        const buffer = await response.body();
                        const imgPath = path.join(IMAGE_DIR, `${lattesId}.jpg`);
                        await fs.promises.writeFile(imgPath, buffer);
                        log.info(`[Lattes] Imagem salva para ID ${lattesId}`);
                        return true;
                    }
                } finally {
                    await response.dispose();
                }
            }
        }
    } catch (e: any) {
        log.warning(`[Lattes] Não foi possível baixar imagem para ID ${lattesId}: ${e.message}`);
    }
    return false;
}

async function closeModal(page: Page) {
    try {
        await page.keyboard.press('Escape');
        await sleep(500);
        const closeSelectors = ['.ui-dialog-titlebar-close', '.botaoFechar', 'a:has-text("Fechar")', '.close'];
        for (const selector of closeSelectors) {
            if (await page.locator(selector).count() > 0) {
                await page.click(selector);
                await sleep(500);
                break;
            }
        }
    } catch (e) {}
}

export type LattesTarget = { nome: string; lattesId: string };
type BatchMetrics = { pesquisadoresExtraidos: number; pesquisadoresComErro: number; tamanhoTotalBytes: number; producoesExtraidas: number; retries: number };
export type LattesProgressUpdate = {
    etapa: 'INICIANDO' | 'BUSCANDO' | 'ANALISANDO_RESULTADOS' | 'ABRINDO_CURRICULO' | 'EXTRAINDO_CURRICULO' | 'SALVANDO_JSON' | 'BAIXANDO_IMAGEM' | 'CONCLUIDO';
    percentual: number;
    paginaAtual: number | null;
    paginasTotal: number | null;
};
export type LattesProgressReporter = (progress: LattesProgressUpdate) => Promise<void>;
export type LattesCollectionResult = {
    lattesId: string;
    arquivoJson: string;
    tamanhoTotalBytes: number;
    producoesExtraidas: number;
    imagemBaixada: boolean;
};

export class LattesCollectionError extends Error {
    constructor(message: string, readonly tipoErro: TipoErroColeta = TipoErroColeta.DESCONHECIDO) {
        super(message);
        this.name = 'LattesCollectionError';
    }
}

type LattesBatchOptions = {
    persistLifecycle?: boolean;
    reportProgress?: LattesProgressReporter;
    executionId?: string;
};

// HTML e DOM do Cheerio ficam restritos ao parsing sincrono, sem atravessar awaits.
function parseCurriculum(html: string, target: LattesTarget) {
    const $ = cheerio.load(html);
    const basicInfo = parser.extractBasicInfo($);
    const parsedId = basicInfo.lattes.replace(/https?:\/\/lattes\.cnpq\.br\//, '').trim();
    if (!/^\d{16}$/.test(parsedId)) throw new Error('Curriculo sem ID Lattes valido; a pagina pode estar incompleta.');
    if (target.lattesId && parsedId !== target.lattesId) return { matched: false as const, parsedId };
    const productions = parser.extractProductionDetails($);
    const producoesExtraidas = Object.values(productions).reduce<number>((total, items) => total + (Array.isArray(items) ? items.length : 0), 0);
    return {
        matched: true as const,
        producoesExtraidas,
        data: {
            nome: target.nome,
            lattesId: parsedId,
            ...basicInfo,
            ...parser.extractProjectDetails($),
            ...parser.extractEventDetails($),
            ...parser.extractFormationDetails($),
            ...productions,
        },
    };
}

type LattesSearchResult = {
    index: number;
    nome: string;
    lattesId: string;
    source: 'list-item' | 'result-link';
};

async function readSearchResults(page: Page) {
    const listResults = await page.locator('ol li').evaluateAll((items) => items.flatMap((item, index) => {
        const text = (item.textContent || '').replace(/\s+/g, ' ');
        const match = text.match(/(.*?)\s+Endereço para acessar este CV:\s*https?:\/\/lattes\.cnpq\.br\/(\d{16})/);
        if (!match) return [];

        return [{
            index,
            nome: match[1].trim(),
            lattesId: match[2],
            source: 'list-item' as const,
        }];
    })) as LattesSearchResult[];

    if (listResults.length > 0) return listResults;

    return await page.locator('.resultado b a').evaluateAll((links) => links.flatMap((link, index) => {
        const nome = (link.textContent || '').replace(/\s+/g, ' ').trim();
        if (!nome) return [];

        const href = link.getAttribute('href') || '';
        const row = link.closest('li');
        const parentText = row?.querySelectorAll('b a').length === 1 ? (row.textContent || '').replace(/\s+/g, ' ') : '';
        const lattesId = parentText.match(/https?:\/\/lattes\.cnpq\.br\/(\d{16})/)?.[1]
            || href.match(/lattes\.cnpq\.br\/(\d{16})/)?.[1]
            || '';

        return [{
            index,
            nome,
            lattesId,
            source: 'result-link' as const,
        }];
    })) as LattesSearchResult[];
}

async function hasStaleFileHandleResults(page: Page) {
    return page.locator('.resultado ol li').evaluateAll(items => items.some(item =>
        (item.textContent || '').trim().toLocaleLowerCase() === 'stale file handle',
    ));
}

async function submitPagination(page: Page, pageNumber: number, recordsPerPage: number) {
    const inicio = (pageNumber - 1) * recordsPerPage;
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
        page.evaluate(({ inicio, count }) => {
            (window as any).submeterPaginacao(inicio, count);
        }, { inicio, count: recordsPerPage }),
    ]);
    await sleep(1000);
}

function findMatchingResult(results: LattesSearchResult[], target: LattesTarget) {
    if (target.lattesId) {
        return results.find(result => result.lattesId === target.lattesId)
            || results.find(result => !result.lattesId && normalizeName(result.nome) === normalizeName(target.nome))
            || null;
    }

    return results.find(result => normalizeName(result.nome) === normalizeName(target.nome)) || null;
}

function getSearchResultLink(page: Page, result: LattesSearchResult) {
    if (result.source === 'list-item') {
        return page.locator('ol li').nth(result.index).locator("a[href*='abrirExtrato'], .resultado b a, b a, a").first();
    }

    return page.locator('.resultado b a').nth(result.index);
}

async function runLattesScraperBatch(
    targets: LattesTarget[],
    pipelineLogger: SharedPipelineLogger | null,
    pipelineLogId: string | null,
    batchInfo: { index: number; total: number },
    onFinished: (metrics: BatchMetrics) => void,
    batchOptions: LattesBatchOptions = {},
): Promise<LattesCollectionResult[]> {
    const persistLifecycle = batchOptions.persistLifecycle !== false;
    const reportProgress = batchOptions.reportProgress ?? (async () => {});
    let pesquisadoresExtraidos = 0;
    let pesquisadoresComErro = 0;
    const batchStartedAt = performance.now();
    const activeTargets = new Map<string, { target: LattesTarget; startedAt: number }>();
    const settledTargets = new Set<string>();
    let tamanhoTotalBytes = 0;
    let producoesExtraidas = 0;
    let totalRetries = 0;
    const collectedResults = new Map<string, LattesCollectionResult>();
    const failures = new Map<string, LattesCollectionError>();

    async function recordFailure(key: string, target: LattesTarget, error: Error, retries: number, tipoErro: TipoErroColeta = TipoErroColeta.DESCONHECIDO) {
        if (settledTargets.has(key)) return;
        const tempoMs = Math.round(performance.now() - (activeTargets.get(key)?.startedAt ?? batchStartedAt));
        if (persistLifecycle && pipelineLogger) {
            const errorItem = await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.PESQUISADOR_LATTES, StatusItemLog.ERRO, {
                entidadeId: target.lattesId || target.nome,
                tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                tipoErro,
                mensagemErro: error.message,
                detalhesErro: error.stack,
                tempoMs,
            });
            if (target.lattesId) {
                await db.updatePesquisadorQueueStatus(target.lattesId, FilaExtracaoStatus.ERRO, { ultimoErroId: errorItem?.id });
            }
        }
        failures.set(key, new LattesCollectionError(error.message, tipoErro));
        settledTargets.add(key);
        activeTargets.delete(key);
        pesquisadoresComErro++;
        log.warning('[Lattes] Pesquisador finalizado com erro', { lattesId: target.lattesId, nome: target.nome, tempoMs, retries, pid: process.pid, ...memorySnapshot() });
    }

    log.info(`[Lattes] Iniciando lote ${batchInfo.index}/${batchInfo.total}`, { pesquisadores: targets.length, workers: SCRAPER_SETTINGS.lattes.maxConcurrency, pid: process.pid, ...memorySnapshot() });
    const crawlerConfig = createCrawlerConfig('lattes', batchOptions.executionId);
    if (!persistLifecycle) crawlerConfig.set('persistStorage', false);
    log.info(`[Lattes] Storage Crawlee: ${CRAWLER_STORAGE_DIRS.lattes}`);
    await purgeCrawlerStorage(crawlerConfig);

    const options = createCrawlerOptions('lattes');
    const crawler = new PlaywrightCrawler({
        ...options,
        maxRequestRetries: persistLifecycle ? options.maxRequestRetries : 0,
        maxSessionRotations: persistLifecycle ? options.maxSessionRotations : 0,
        preNavigationHooks: [
            async ({ request }) => {
                if (activeTargets.has(request.uniqueKey)) return;
                const target = { nome: request.userData.name, lattesId: request.userData.targetLattesId };
                if (persistLifecycle && target.lattesId) await db.updatePesquisadorQueueStatus(target.lattesId, FilaExtracaoStatus.PROCESSANDO);
                activeTargets.set(request.uniqueKey, { target, startedAt: performance.now() });
                await reportProgress({ etapa: 'BUSCANDO', percentual: 10, paginaAtual: null, paginasTotal: null });
            },
            ...(options.preNavigationHooks ?? []),
        ],
        async errorHandler({ request }, error) {
            totalRetries++;
            log.warning('[Lattes] Falha transitoria; nova tentativa pelo Crawlee', { lattesId: request.userData.targetLattesId, retryCount: request.retryCount, erro: error.message, pid: process.pid, ...memorySnapshot() });
        },
        async failedRequestHandler({ request }, error) {
            await recordFailure(request.uniqueKey, { nome: request.userData.name, lattesId: request.userData.targetLattesId }, error, request.retryCount);
        },

        async requestHandler({ page, request }) {
            const { name, targetLattesId } = request.userData;
            log.info(`🔍 Buscando no Lattes: ${name} (ID Esperado: ${targetLattesId || 'N/A'})`);

            const startTimer = activeTargets.get(request.uniqueKey)?.startedAt ?? performance.now();

            await page.goto(LATTES_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.fill("input[id='textoBusca']", name);
            const buscarDemais = await page.$("input[id='buscarDemais']");
            if (buscarDemais) await buscarDemais.click();

            await submitLattesSearch(page, () => page.click("a[id='botaoBuscaFiltros']"), {
                lattesId: targetLattesId,
                nome: name,
                tentativa: request.retryCount + 1,
            });

            let success = false;
            let lastPopupError: Error | undefined;
            let pageNumber = 1;
            const checkedResults = new Set<string>();
            const staleResultRetries = new Map<number, number>();

            while (!success) {
                const pagStatus = await getPaginationStatus(page);
                const results = await readSearchResults(page);
                const hasStaleResults = await hasStaleFileHandleResults(page);

                if (hasStaleResults && pagStatus) {
                    const retry = (staleResultRetries.get(pageNumber) ?? 0) + 1;
                    if (retry <= SCRAPER_SETTINGS.lattes.staleResultMaxRetries) {
                        staleResultRetries.set(pageNumber, retry);
                        log.warning('[Lattes] Servidor retornou Stale file handle; repetindo somente a pagina atual.', {
                            nome: name,
                            lattesId: targetLattesId || null,
                            paginaAtual: pageNumber,
                            tentativaLocal: retry,
                            maxTentativasLocais: SCRAPER_SETTINGS.lattes.staleResultMaxRetries,
                            esperaMs: SCRAPER_SETTINGS.lattes.staleResultRetryDelayMs,
                        });
                        await sleep(SCRAPER_SETTINGS.lattes.staleResultRetryDelayMs);
                        await submitPagination(page, pageNumber, pagStatus.recordsPerPage);
                        continue;
                    }
                }

                if (!pagStatus
                    || (pagStatus.currentPage !== null && pagStatus.currentPage !== pageNumber)
                    || (pagStatus.totalRecords > 0 && results.length === 0)
                    || results.length > pagStatus.totalRecords) {
                    const incompleteResultError = new Error(`Resultado Lattes incompleto na pagina ${pageNumber}; a paginacao ou a lista de resultados nao foi confirmada.`);
                    await captureLattesSearchFailure(page, {
                        lattesId: targetLattesId,
                        nome: name,
                        tentativa: request.retryCount + 1,
                        paginaAtual: pageNumber,
                    }, incompleteResultError);
                    throw incompleteResultError;
                }
                const totalPages = Math.max(1, Math.ceil(pagStatus.totalRecords / pagStatus.recordsPerPage));
                await reportProgress({ etapa: 'ANALISANDO_RESULTADOS', percentual: 25, paginaAtual: pageNumber, paginasTotal: totalPages });
                const resultKey = (result: LattesSearchResult) => `${pageNumber}:${result.source}:${result.index}`;
                const match = findMatchingResult(results.filter(result => !checkedResults.has(resultKey(result))), { nome: name, lattesId: targetLattesId });
                log.info('[Lattes] Página de resultados analisada', {
                    nome: name,
                    paginaAtual: pageNumber,
                    totalPaginas: totalPages,
                    resultadosNaPagina: results.length,
                    lattesIdEncontrado: match?.lattesId || null,
                });

                if (!match) {
                    const nextPage = pageNumber + 1;
                    const nextInicio = (nextPage - 1) * pagStatus.recordsPerPage;

                    if (nextInicio < pagStatus.totalRecords) {
                        log.info(`[Lattes] ID não encontrado na página ${pageNumber} de ${totalPages}. Avançando para a página ${nextPage}...`);
                        await submitPagination(page, nextPage, pagStatus.recordsPerPage);
                        pageNumber = nextPage;
                        continue;
                    }

                    await recordFailure(request.uniqueKey, { nome: name, lattesId: targetLattesId },
                        new Error(`Nenhum resultado coincidiu com o ID esperado (${targetLattesId}) para ${name}`), request.retryCount, TipoErroColeta.NAO_ENCONTRADO);
                    break;
                }

                const resultLink = getSearchResultLink(page, match);

                log.info('[Lattes] Candidato encontrado; validando no curriculo.', { nome: match.nome, idNaBusca: match.lattesId || null, idEsperado: targetLattesId || null });
                await reportProgress({ etapa: 'ABRINDO_CURRICULO', percentual: 45, paginaAtual: pageNumber, paginasTotal: totalPages });
                await resultLink.click();

                try {
                    await page.waitForSelector(".moldal-interna", { state: "visible", timeout: 15000 });
                } catch (e) {
                    log.warning(`⚠️ [Lattes] Modal de detalhes não abriu para ${match.nome} (${match.lattesId})`);
                    lastPopupError = e instanceof Error ? e : new Error(String(e));
                    await closeModal(page);
                    throw lastPopupError;
                }

                const frame = page.frameLocator("iframe.iframe-modal");
                const cvLink = frame.locator("a:has-text('Currículo Lattes')");

                const activePopups = new Set<Page>();
                const popupListener = (p: Page) => {
                    activePopups.add(p);
                    p.once('close', () => activePopups.delete(p));
                };
                page.on('popup', popupListener);

                let openedPopup: Page | null = null;

                try {
                    [openedPopup] = await Promise.all([
                        page.waitForEvent('popup', { timeout: 30000 }),
                        cvLink.evaluate(el => (el as HTMLElement).click()),
                    ]);

                    await openedPopup.waitForLoadState("domcontentloaded");
                    await openedPopup.waitForSelector('.informacoes-autor', { state: 'attached', timeout: 30000 });
                    await reportProgress({ etapa: 'EXTRAINDO_CURRICULO', percentual: 65, paginaAtual: pageNumber, paginasTotal: totalPages });
                    const parsed = parseCurriculum(await openedPopup.content(), { nome: name, lattesId: targetLattesId });
                    if (!parsed.matched) {
                        checkedResults.add(resultKey(match));
                        log.warning('[Lattes] Candidato com ID diferente; continuando a busca.', {
                            nome: match.nome, idEsperado: targetLattesId, idLido: parsed.parsedId, pagina: pageNumber,
                        });
                        continue;
                    }
                    const finalId = parsed.data.lattesId;
                    if (finalId) {
                        await reportProgress({ etapa: 'SALVANDO_JSON', percentual: 85, paginaAtual: pageNumber, paginasTotal: totalPages });
                        const jsonBytes = saveJson(parsed.data, LATTES_DATA_DIR, finalId);
                        await reportProgress({ etapa: 'BAIXANDO_IMAGEM', percentual: 92, paginaAtual: pageNumber, paginasTotal: totalPages });
                        const imagemBaixada = await downloadProfileImage(openedPopup, finalId);
                        const tempoMs = Math.round(performance.now() - startTimer);
                        log.info(`✅ [Lattes] Sucesso: ${name} (ID: ${finalId})`);
                        if (persistLifecycle && targetLattesId) await db.updatePesquisadorQueueStatus(targetLattesId, FilaExtracaoStatus.CONCLUIDO);
                        settledTargets.add(request.uniqueKey);
                        activeTargets.delete(request.uniqueKey);
                        pesquisadoresExtraidos++;
                        tamanhoTotalBytes += jsonBytes;
                        producoesExtraidas += parsed.producoesExtraidas;
                        collectedResults.set(request.uniqueKey, {
                            lattesId: finalId,
                            arquivoJson: `${finalId}.json`,
                            tamanhoTotalBytes: jsonBytes,
                            producoesExtraidas: parsed.producoesExtraidas,
                            imagemBaixada,
                        });
                        log.info('[Lattes] Metricas do pesquisador', { lattesId: finalId, tempoMs, producoesExtraidas: parsed.producoesExtraidas, jsonBytes, retries: request.retryCount, lote: batchInfo.index, pid: process.pid, ...memorySnapshot() });

                        if (persistLifecycle && pipelineLogger) await pipelineLogger.pipelineLogItem(
                            pipelineLogId,
                            PipelineEtapa.PESQUISADOR_LATTES,
                            StatusItemLog.SUCESSO,
                            {
                                entidadeId: finalId,
                                tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                                tempoMs,
                            }
                        );
                    }

                    success = true;
                } catch (e: any) {
                    log.error(`❌ [Lattes] Erro ao extrair no popup: ${e.message}`);
                    lastPopupError = e instanceof Error ? e : new Error(String(e));
                } finally {
                    page.off('popup', popupListener);
                    if (openedPopup && !openedPopup.isClosed()) {
                        try {
                            await openedPopup.close();
                        } catch (e) {}
                    }
                    for (const p of activePopups) {
                        if (p !== page && !p.isClosed()) {
                            try {
                                await p.close();
                            } catch (e) {}
                        }
                    }
                    activePopups.clear();
                    await closeModal(page);
                }

                if (!success && lastPopupError) {
                    throw lastPopupError;
                }
            }
        },
    }, crawlerConfig);

    try {
        await crawler.addRequests(targets.map(target => ({
            url: LATTES_URL,
            userData: { name: target.nome, targetLattesId: target.lattesId },
            uniqueKey: `LATTES-${batchInfo.index}-${target.lattesId || target.nome}`
        })));

        await crawler.run();
        if (!persistLifecycle) {
            const failure = failures.values().next().value;
            if (failure) throw failure;
            if (collectedResults.size !== targets.length) throw new LattesCollectionError('Crawler Lattes terminou sem produzir o resultado esperado.');
        }
    } catch (error) {
        // Somente itens que chegaram a iniciar sao encerrados; os demais continuam pendentes.
        for (const [key, { target }] of activeTargets) {
            await recordFailure(key, target, error instanceof Error ? error : new Error(String(error)), 0);
        }
        throw error;
    } finally {
        onFinished({ pesquisadoresExtraidos, pesquisadoresComErro, tamanhoTotalBytes, producoesExtraidas, retries: totalRetries });
        await crawler.browserPool.destroy();
        log.info(`[Lattes] Lote ${batchInfo.index}/${batchInfo.total} encerrado`, { tempoMs: Math.round(performance.now() - batchStartedAt), pesquisadoresExtraidos, pesquisadoresComErro, tamanhoTotalBytes, producoesExtraidas, retries: totalRetries, pid: process.pid, ...memorySnapshot() });
    }
    return [...collectedResults.values()];
}

export async function collectLattesResearcher(target: LattesTarget, reportProgress: LattesProgressReporter = async () => {}) {
    await reportProgress({ etapa: 'INICIANDO', percentual: 0, paginaAtual: null, paginasTotal: null });
    const results = await runLattesScraperBatch(
        [target], null, null, { index: 1, total: 1 }, () => {},
        { persistLifecycle: false, reportProgress, executionId: `bull-${randomUUID()}` },
    );
    return results[0];
}

export async function runLattesScraper(names: string[] = [], pipelineLoggerPrev?: SharedPipelineLogger, dgpGrupo: string | null = null) {
    if (await db.hasOpenLattesQueueBatch()) {
        throw new Error('Existe um lote BullMQ Lattes em andamento. Finalize ou reconcilie a fila antes de iniciar o scraper tradicional.');
    }
    let targets: { nome: string; lattesId: string }[] = [];

    if (!names || names.length === 0) {
        const recovered = await db.resetProcessingResearchersQueue();
        if (recovered.count > 0) {
            log.warning('[Lattes] Pesquisadores presos em PROCESSANDO foram devolvidos para PENDENTE antes da execucao.', {
                pesquisadoresRecuperados: recovered.count,
            });
        }

        const pending = await prisma.filaExtracaoPesquisador.findMany({
            where: { status: FilaExtracaoStatus.PENDENTE },
            take: SCRAPER_SETTINGS.lattes.take,
            select: { nome: true, lattesId: true },
        });
        if (pending.length === 0) {
            log.info("[Lattes] Nenhum pesquisador pendente na fila.");
            return;
        }
        targets = pending.map(p => ({ nome: p.nome, lattesId: p.lattesId }));
    } else {
        for (const name of names) {
            const row = await prisma.filaExtracaoPesquisador.findFirst({
                where: { nome: name }
            });
            targets.push({ nome: name, lattesId: row ? row.lattesId : '' });
        }
    }

    let pipelineLogger: SharedPipelineLogger;
    let pipelineLogId: string | null = null;
    let pesquisadoresExtraidos = 0;
    let pesquisadoresComErro = 0;

    if (pipelineLoggerPrev != null && pipelineLoggerPrev != undefined) {
        pipelineLogger = pipelineLoggerPrev;
    } else {
        pipelineLogger = new SharedPipelineLogger(prisma);
        pipelineLogId = await pipelineLogger.startPipelineLogger(ModuloSistema.SCRAPER, "LATTES_EXTRACTION", ModoExecucao.APENAS_LATTES, {
            comando: 'lattes-scraper',
            itensFila: targets.length,
            pesquisadoresPendentes: targets.length,
        });
    }

    let tamanhoTotalBytes = 0;
    let producoesExtraidas = 0;
    let retries = 0;
    const targetBatches = chunkArray(targets, SCRAPER_SETTINGS.lattes.batchSize);
    let fatalError: unknown;
    try {
        for (const [index, batch] of targetBatches.entries()) {
            await runLattesScraperBatch(batch, pipelineLogger, pipelineLogId, {
                index: index + 1,
                total: targetBatches.length,
            }, result => {
                pesquisadoresExtraidos += result.pesquisadoresExtraidos;
                pesquisadoresComErro += result.pesquisadoresComErro;
                tamanhoTotalBytes += result.tamanhoTotalBytes;
                producoesExtraidas += result.producoesExtraidas;
                retries += result.retries;
            });
        }
    } catch (error) {
        fatalError = error;
        throw error;
    } finally {

        log.info('[Lattes] Execucao encerrada.', { pesquisadoresExtraidos, pesquisadoresComErro, erroFatal: Boolean(fatalError) });
        if (!pipelineLoggerPrev && pipelineLogId) {
            await pipelineLogger.finishPipelineLogger(
                pipelineLogId,
                fatalError || pesquisadoresComErro > 0 ? StatusSessao.ERRO : StatusSessao.CONCLUIDO,
                {
                    comando: 'lattes-scraper',
                    itensFila: targets.length,
                    pesquisadoresPendentes: targets.length - pesquisadoresExtraidos - pesquisadoresComErro,
                    pesquisadoresExtraidos,
                    arquivosJsonGerados: pesquisadoresExtraidos,
                    pesquisadoresComErro,
                    tamanhoTotalBytes,
                    producoesExtraidas,
                    retries,
                    erroFatal: fatalError instanceof Error ? fatalError.message : undefined,
                    ...memorySnapshot(),
                }
            );
        }
    }
}
