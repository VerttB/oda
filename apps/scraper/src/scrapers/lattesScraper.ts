import { PlaywrightCrawler, log } from 'crawlee';
import { Page } from 'playwright';
import { LattesParser } from '../parsers/lattesParser';
import { saveJson, LATTES_DATA_DIR, IMAGE_DIR } from '../common/config';
import { prisma, db } from '../common/database';
import { FilaExtracaoStatus, TipoErroColeta, StatusSessao, StatusItemLog, TipoEntidadeLog, ModuloSistema, ModoExecucao, SharedPipelineLogger } from '@oda/database';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

const parser = new LattesParser();
const LATTES_URL = "https://buscatextual.cnpq.br/buscatextual/busca.do";
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeName(n: string): string {
    return n.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ');
}

async function downloadProfileImage(page: Page, lattesId: string) {
    try {
        const imgElement = await page.$("img.foto");
        if (imgElement) {
            const src = await imgElement.getAttribute('src');
            if (src) {
                const absoluteUrl = src.startsWith('http') ? src : `https://buscatextual.cnpq.br/buscatextual/${src}`;
                const response = await page.request.get(absoluteUrl);
                if (response.ok()) {
                    const buffer = await response.body();
                    const imgPath = path.join(IMAGE_DIR, `${lattesId}.jpg`);
                    fs.writeFileSync(imgPath, buffer);
                    log.info(`[Lattes] Imagem salva para ID ${lattesId}`);
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

export async function runLattesScraper(names: string[] = [], pipelineLoggerPrev?: SharedPipelineLogger, dgpGrupo: string | null = null) {
    let targets: { nome: string; lattesId: string }[] = [];

    if (!names || names.length === 0) {
        const pending = await prisma.filaExtracaoPesquisador.findMany({
            where: { status: FilaExtracaoStatus.PENDENTE },
            take: 50
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

    if (pipelineLoggerPrev != null && pipelineLoggerPrev != undefined) {
        pipelineLogger = pipelineLoggerPrev;
    } else {
        pipelineLogger = new SharedPipelineLogger(prisma);
        pipelineLogId = await pipelineLogger.startPipelineLogger(ModuloSistema.SCRAPER, "LATTES_EXTRACTION", ModoExecucao.APENAS_LATTES);
    }

    // Coloca os itens da fila em PROCESSANDO
    for (const target of targets) {
        if (target.lattesId) {
            await db.updatePesquisadorQueueStatus(target.lattesId, FilaExtracaoStatus.PROCESSANDO);
        }
    }

    log.info(`🚀 Iniciando Scraper Lattes para ${targets.length} pesquisadores com Crawlee (2 Workers)`);

    const crawler = new PlaywrightCrawler({
        launchContext: {
            useIncognitoPages: true,
            userDataDir: '',
            launchOptions: {
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            }
        },
        browserPoolOptions: {
            useFingerprints: true,
            maxOpenPagesPerBrowser: 5,
            retireBrowserAfterPageCount: 20,
            fingerprintOptions: {
                fingerprintGeneratorOptions: {
                    browsers: ['chrome'],
                    devices: ['desktop'],
                    operatingSystems: ['windows']
                }
            }
        },
        maxConcurrency: 2,
        requestHandlerTimeoutSecs: 300,
        maxRequestRetries: 2,

        async requestHandler({ page, request }) {
            const { name, targetLattesId } = request.userData;
            log.info(`🔍 Buscando no Lattes: ${name} (ID Esperado: ${targetLattesId || 'N/A'})`);

            const startTimer = performance.now();

            await page.goto(LATTES_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            await page.fill("input[id='textoBusca']", name);
            const buscarDemais = await page.$("input[id='buscarDemais']");
            if (buscarDemais) await buscarDemais.click();

            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
                page.click("a[id='botaoBuscaFiltros']"),
            ]);
            
            try {
                await page.waitForSelector(".resultado", { timeout: 30000 });
            } catch (e: any) {
                log.warning(`⚠️ [Lattes] Pesquisador não encontrado: ${name}`);
                if (targetLattesId) {
                    await pipelineLogger.pipelineLogItem(
                        pipelineLogId,
                        'PESQUISADOR_LATTES',
                        StatusItemLog.ERRO,
                        {
                            entidadeId: targetLattesId || null,
                            tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                            tipoErro: TipoErroColeta.NAO_ENCONTRADO,
                            mensagemErro: `Pesquisador não encontrado na busca do Lattes.`,
                            detalhesErro: e.stack || null,
                        }
                    );
                    await db.updatePesquisadorQueueStatus(targetLattesId, FilaExtracaoStatus.PENDENTE);
                }
                return;
            }

            const results = page.locator(".resultado b a");
            const count = await results.count();
            log.info(`[Lattes] Encontrados ${count} resultados na busca para o nome: ${name}`);

            let success = false;

            for (let i = 0; i < count; i++) {
                const resultLink = results.nth(i);
                const linkText = (await resultLink.textContent())?.trim() || "";

                if (normalizeName(linkText) !== normalizeName(name) && !targetLattesId) {
                    log.info(`[Lattes] Nome no resultado "${linkText}" não corresponde exatamente a "${name}". Pulando...`);
                    continue;
                }

                log.info(`[Lattes] Verificando resultado ${i + 1} de ${count}: ${linkText}...`);
                await resultLink.click();

                try {
                    await page.waitForSelector(".moldal-interna", { state: "visible", timeout: 15000 });
                } catch (e) {
                    log.warning(`⚠️ [Lattes] Modal de detalhes não abriu para o resultado ${i + 1}`);
                    continue;
                }

                const frame = page.frameLocator("iframe.iframe-modal");
                const cvLink = frame.locator("a:has-text('Currículo Lattes')");

                const activePopups = new Set<Page>();
                const popupListener = (p: Page) => {
                    activePopups.add(p);
                    p.once('close', () => activePopups.delete(p));
                };
                page.on('popup', popupListener);

                try {
                    const [openedPopup] = await Promise.all([
                        page.waitForEvent('popup', { timeout: 30000 }),
                        cvLink.evaluate(el => (el as HTMLElement).click()),
                    ]);

                    await openedPopup.waitForLoadState("domcontentloaded");
                    await sleep(500);

                    const html = await openedPopup.content();
                    const $ = cheerio.load(html);

                    const basicInfo = parser.extractBasicInfo($);
                    const parsedLattesId = basicInfo.lattes ? basicInfo.lattes.replace(/https?:\/\/lattes\.cnpq\.br\//, '').trim() : '';

                    log.info(`[Lattes] ID do Lattes analisado no CV: ${parsedLattesId} (Esperado: ${targetLattesId || 'Qualquer'})`);

                    if (targetLattesId && parsedLattesId !== targetLattesId) {
                        log.warning(`[Lattes] ID do Lattes diferente do esperado (${parsedLattesId} vs ${targetLattesId}). Fechando e tentando próximo...`);
                        await openedPopup.close();
                        await closeModal(page);
                        continue;
                    }

                    const projects = parser.extractProjectDetails($);
                    const events = parser.extractEventDetails($);
                    const formations = parser.extractFormationDetails ? parser.extractFormationDetails($) : {};
                    const productions = parser.extractProductionDetails ? parser.extractProductionDetails($) : {};

                    await downloadProfileImage(openedPopup, parsedLattesId || targetLattesId);

                    const endTimer = performance.now();
                    const tempoMs = Math.round(endTimer - startTimer);

                    const fullData = {
                        nome: name,
                        lattesId: parsedLattesId || targetLattesId,
                        ...basicInfo,
                        ...projects,
                        ...events,
                        ...formations,
                        ...productions
                    };

                    const finalId = parsedLattesId || targetLattesId;
                    if (finalId) {
                        saveJson(fullData, LATTES_DATA_DIR, finalId);
                        log.info(`✅ [Lattes] Sucesso: ${name} (ID: ${finalId})`);
                        await db.updatePesquisadorQueueStatus(finalId, FilaExtracaoStatus.CONCLUIDO);

                        await pipelineLogger.pipelineLogItem(
                            pipelineLogId,
                            'PESQUISADOR_LATTES',
                            StatusItemLog.SUCESSO,
                            {
                                entidadeId: finalId,
                                tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                                tempoMs,
                            }
                        );
                    }

                    await openedPopup.close();
                    await closeModal(page);
                    success = true;
                    break;
                } catch (e: any) {
                    log.error(`❌ [Lattes] Erro ao extrair no popup: ${e.message}`);
                    await closeModal(page);
                } finally {
                    page.off('popup', popupListener);
                    for (const p of activePopups) {
                        if (p !== page) {
                            try {
                                await p.close();
                            } catch (e) {}
                        }
                    }
                    activePopups.clear();
                }
            }

            if (!success && targetLattesId) {
                log.warning(`⚠️ [Lattes] Nenhum resultado coincidiu com o ID esperado (${targetLattesId}) para ${name}`);
                const endTimer = performance.now();
                const tempoMs = Math.round(endTimer - startTimer);

                await pipelineLogger.pipelineLogItem(
                    pipelineLogId,
                    'PESQUISADOR_LATTES',
                    StatusItemLog.ERRO,
                    {
                        entidadeId: targetLattesId || null,
                        tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                        tipoErro: TipoErroColeta.NAO_ENCONTRADO,
                        mensagemErro: `Nenhum resultado coincidiu com o ID esperado (${targetLattesId}) para ${name}`,
                        tempoMs,
                    }
                );
                await db.updatePesquisadorQueueStatus(targetLattesId, FilaExtracaoStatus.PENDENTE);
            }
        },
    });

    await crawler.addRequests(targets.map(target => ({
        url: LATTES_URL,
        userData: { name: target.nome, targetLattesId: target.lattesId },
        uniqueKey: `LATTES-${target.lattesId || target.nome}`
    })));

    await crawler.run();
    log.info('🏁 Scraper Lattes finalizado.');

    if (!pipelineLoggerPrev && pipelineLogId) {
        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.CONCLUIDO);
    }
}
