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
import { submitLattesSearch } from '../common/lattesSearchNavigation';

const parser = new LattesParser();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeName(n: string): string {
    return n.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
}

async function getPaginationStatus(page: Page) {
    try {
        return await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            const targetScript = scripts.find(s => s.textContent && s.textContent.includes('intLTotReg'));
            if (!targetScript?.textContent) return null;

            const totalRecords = Number(targetScript.textContent.match(/var\s+intLTotReg\s*=\s*(\d+)/)?.[1] || 0);
            const recordsPerPage = Number(targetScript.textContent.match(/var\s+intLRegPagina\s*=\s*(\d+)/)?.[1] || 10);
            const currentPageText = document.querySelector('a[data-role="paginacao"] font[color="#ff0000"]')?.textContent
                || document.querySelector('a[data-role="paginacao"].is-current')?.textContent
                || '1';
            const currentPage = Number.parseInt(currentPageText, 10) || 1;

            return { totalRecords, recordsPerPage, currentPage };
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

async function downloadProfileImage(page: Page, lattesId: string) {
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
                    }
                } finally {
                    await response.dispose();
                }
            }
        }
    } catch (e: any) {
        log.warning(`[Lattes] Não foi possível baixar imagem para ID ${lattesId}: ${e.message}`);
    }
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

type LattesTarget = { nome: string; lattesId: string };
type BatchMetrics = { pesquisadoresExtraidos: number; pesquisadoresComErro: number; tamanhoTotalBytes: number; producoesExtraidas: number; retries: number };

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
    pipelineLogger: SharedPipelineLogger,
    pipelineLogId: string | null,
    batchInfo: { index: number; total: number },
    onFinished: (metrics: BatchMetrics) => void,
) {
    let pesquisadoresExtraidos = 0;
    let pesquisadoresComErro = 0;
    const batchStartedAt = performance.now();
    const activeTargets = new Map<string, { target: LattesTarget; startedAt: number }>();
    const settledTargets = new Set<string>();
    let tamanhoTotalBytes = 0;
    let producoesExtraidas = 0;
    let totalRetries = 0;

    async function recordFailure(key: string, target: LattesTarget, error: Error, retries: number, tipoErro: TipoErroColeta = TipoErroColeta.DESCONHECIDO) {
        if (settledTargets.has(key)) return;
        const tempoMs = Math.round(performance.now() - (activeTargets.get(key)?.startedAt ?? batchStartedAt));
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
        settledTargets.add(key);
        activeTargets.delete(key);
        pesquisadoresComErro++;
        log.warning('[Lattes] Pesquisador finalizado com erro', { lattesId: target.lattesId, nome: target.nome, tempoMs, retries, ...memorySnapshot() });
    }

    log.info(`[Lattes] Iniciando lote ${batchInfo.index}/${batchInfo.total}`, { pesquisadores: targets.length, workers: SCRAPER_SETTINGS.lattes.maxConcurrency, ...memorySnapshot() });
    const crawlerConfig = createCrawlerConfig('lattes');
    log.info(`[Lattes] Storage Crawlee: ${CRAWLER_STORAGE_DIRS.lattes}`);
    await purgeCrawlerStorage(crawlerConfig);

    const options = createCrawlerOptions('lattes');
    const crawler = new PlaywrightCrawler({
        ...options,
        preNavigationHooks: [
            async ({ request }) => {
                if (activeTargets.has(request.uniqueKey)) return;
                const target = { nome: request.userData.name, lattesId: request.userData.targetLattesId };
                if (target.lattesId) await db.updatePesquisadorQueueStatus(target.lattesId, FilaExtracaoStatus.PROCESSANDO);
                activeTargets.set(request.uniqueKey, { target, startedAt: performance.now() });
            },
            ...(options.preNavigationHooks ?? []),
        ],
        async errorHandler({ request }, error) {
            totalRetries++;
            log.warning('[Lattes] Falha transitoria; nova tentativa pelo Crawlee', { lattesId: request.userData.targetLattesId, retryCount: request.retryCount, erro: error.message, ...memorySnapshot() });
        },
        async failedRequestHandler({ request }, error) {
            await recordFailure(request.uniqueKey, { nome: request.userData.name, lattesId: request.userData.targetLattesId }, error, request.retryCount);
        },

        async requestHandler({ page, request }) {
            const { name, targetLattesId } = request.userData;
            log.info(`🔍 Buscando no Lattes: ${name} (ID Esperado: ${targetLattesId || 'N/A'})`);

            const startTimer = activeTargets.get(request.uniqueKey)?.startedAt ?? performance.now();
            
            await page.fill("input[id='textoBusca']", name);
            const buscarDemais = await page.$("input[id='buscarDemais']");
            if (buscarDemais) await buscarDemais.click();

            await submitLattesSearch(page, () => page.click("a[id='botaoBuscaFiltros']"));

            let success = false;
            let lastPopupError: Error | undefined;
            let pageNumber = 1;
            const checkedResults = new Set<string>();

            while (!success) {
                const pagStatus = await getPaginationStatus(page);
                const totalPages = pagStatus ? Math.ceil(pagStatus.totalRecords / pagStatus.recordsPerPage) : 1;
                const results = await readSearchResults(page);
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
                    const nextInicio = pagStatus ? (nextPage - 1) * pagStatus.recordsPerPage : 0;

                    if (pagStatus && nextInicio < pagStatus.totalRecords) {
                        log.info(`[Lattes] ID não encontrado na página ${pageNumber} de ${totalPages}. Avançando para a página ${nextPage}...`);
                        await submitLattesSearch(page, () => page.evaluate(({ inicio, count }) => {
                            (window as any).submeterPaginacao(inicio, count);
                        }, { inicio: nextInicio, count: pagStatus.recordsPerPage }));
                        pageNumber = nextPage;
                        continue;
                    }

                    await recordFailure(request.uniqueKey, { nome: name, lattesId: targetLattesId },
                        new Error(`Nenhum resultado coincidiu com o ID esperado (${targetLattesId}) para ${name}`), request.retryCount, TipoErroColeta.NAO_ENCONTRADO);
                    break;
                }

                const resultLink = getSearchResultLink(page, match);

                log.info('[Lattes] Candidato encontrado; validando no curriculo.', { nome: match.nome, idNaBusca: match.lattesId || null, idEsperado: targetLattesId || null });
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
                        const jsonBytes = saveJson(parsed.data, LATTES_DATA_DIR, finalId);
                        await downloadProfileImage(openedPopup, finalId);
                        const tempoMs = Math.round(performance.now() - startTimer);
                        log.info(`✅ [Lattes] Sucesso: ${name} (ID: ${finalId})`);
                        if (targetLattesId) await db.updatePesquisadorQueueStatus(targetLattesId, FilaExtracaoStatus.CONCLUIDO);
                        settledTargets.add(request.uniqueKey);
                        activeTargets.delete(request.uniqueKey);
                        pesquisadoresExtraidos++;
                        tamanhoTotalBytes += jsonBytes;
                        producoesExtraidas += parsed.producoesExtraidas;
                        log.info('[Lattes] Metricas do pesquisador', { lattesId: finalId, tempoMs, producoesExtraidas: parsed.producoesExtraidas, jsonBytes, retries: request.retryCount, lote: batchInfo.index, ...memorySnapshot() });

                        await pipelineLogger.pipelineLogItem(
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
    } catch (error) {
        // Somente itens que chegaram a iniciar sao encerrados; os demais continuam pendentes.
        for (const [key, { target }] of activeTargets) {
            await recordFailure(key, target, error instanceof Error ? error : new Error(String(error)), 0);
        }
        throw error;
    } finally {
        onFinished({ pesquisadoresExtraidos, pesquisadoresComErro, tamanhoTotalBytes, producoesExtraidas, retries: totalRetries });
        await crawler.browserPool.destroy();
        log.info(`[Lattes] Lote ${batchInfo.index}/${batchInfo.total} encerrado`, { tempoMs: Math.round(performance.now() - batchStartedAt), pesquisadoresExtraidos, pesquisadoresComErro, tamanhoTotalBytes, producoesExtraidas, retries: totalRetries, ...memorySnapshot() });
    }

}

export async function runLattesScraper(names: string[] = [], pipelineLoggerPrev?: SharedPipelineLogger, dgpGrupo: string | null = null) {
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
