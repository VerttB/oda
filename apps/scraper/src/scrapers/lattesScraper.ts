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
let pipelineLogger: SharedPipelineLogger | null = null;

async function getPaginationStatus(page: Page) {
    try {
        const info = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            const targetScript = scripts.find(s => s.textContent && s.textContent.includes('intLTotReg'));
            if (!targetScript || !targetScript.textContent) return null;
            
            const text = targetScript.textContent;
            const totMatch = text.match(/var\s+intLTotReg\s*=\s*(\d+)/);
            const regMatch = text.match(/var\s+intLRegPagina\s*=\s*(\d+)/);
            
            const redFont = document.querySelector('a[data-role="paginacao"] font[color="#ff0000"]');
            let currentPage = 1;
            if (redFont) {
                const pageNum = parseInt(redFont.textContent || '', 10);
                if (!isNaN(pageNum)) currentPage = pageNum;
            } else {
                const activeLink = document.querySelector('a[data-role="paginacao"].is-current');
                if (activeLink) {
                    const pageNum = parseInt(activeLink.textContent || '', 10);
                    if (!isNaN(pageNum)) currentPage = pageNum;
                }
            }

            return {
                totalRecords: totMatch ? parseInt(totMatch[1], 10) : 0,
                recordsPerPage: regMatch ? parseInt(regMatch[1], 10) : 10,
                currentPage
            };
        });
        return info;
    } catch (e) {
        return null;
    }
}

async function downloadProfileImage(page: Page, lattesId: string) {
    try {
        const imgElement = await page.$("img[src*='servlet/foto']");
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
    
    let pipelineLogId: string | null = null;
    if(pipelineLoggerPrev){
        if(!dgpGrupo){ throw new Error("Para reutilizar logger, o parâmetro dgpGrupo deve ser fornecido."); }
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
            await page.click("input[id='buscarDemais']");
            await page.click("a[id='botaoBuscaFiltros']");
            
            try {
                await page.waitForSelector(".resultado", { timeout: 40000 });
            } catch (e:any) {
                log.warning(`⚠️ [Lattes] Pesquisador não encontrado: ${name}`);
                if (targetLattesId && pipelineLogger) {
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
                }
                return;
            }

            let success = false;

            while (true) {
                const pagStatus = await getPaginationStatus(page);
                if (!pagStatus) {
                    log.warning("[Lattes] Não foi possível ler informações de paginação.");
                    break;
                }

                const pageNumber = pagStatus.currentPage;
                const totalPages = Math.ceil(pagStatus.totalRecords / pagStatus.recordsPerPage);

                log.info(`[Lattes] Analisando página ${pageNumber} de ${totalPages} (Total de registros: ${pagStatus.totalRecords}) para: ${name}`);

                const resultItems = await page.$$("ol li");

                for (let i = 0; i < resultItems.length; i++) {
                    const li = resultItems[i];
                    const text = await li.innerText();
                    const cleanText = text.replace(/\s+/g, ' ');

                    const match = cleanText.match(/(.*?)\s+Endereço para acessar este CV:\s*http:\/\/lattes\.cnpq\.br\/(\d{16})/);
                    if (!match) continue;

                    const extractedName = match[1].trim();
                    const parsedLattesId = match[2];

                    if (targetLattesId && targetLattesId !== parsedLattesId) {
                        continue;
                    }

                    if (!targetLattesId && normalizeName(extractedName) !== normalizeName(name)) {
                        continue;
                    }

                    log.info(`🎯 Encontrado resultado correspondente: ${extractedName} (ID: ${parsedLattesId})`);

                    const link = await li.$("a[href*='abrirExtrato']");
                    if (!link) continue;

                    const activePopups = new Set<Page>();
                    const popupListener = (p: Page) => {
                        activePopups.add(p);
                        p.once('close', () => activePopups.delete(p));
                    };
                    page.on('popup', popupListener);

                    try {
                        const [openedPopup] = await Promise.all([
                            page.waitForEvent('popup', { timeout: 30000 }),
                            link.click(),
                        ]);

                        await openedPopup.waitForLoadState('domcontentloaded');
                        await openedPopup.waitForSelector('.title-wrapper', { timeout: 30000 });
                        await downloadProfileImage(openedPopup, parsedLattesId);

                        const html = await openedPopup.content();
                        const $ = cheerio.load(html);

                        const basicInfo = parser.extractBasicInfo($);
                        const projects = parser.extractProjectDetails($);
                        const events = parser.extractEventDetails($);
                        const formations = parser.extractFormationDetails($);
                        const productions = parser.extractProductionDetails($);

                        const endTimer = performance.now();
                        const tempoMs = Math.round(endTimer - startTimer);

                        const fullData = {
                            nome: name,
                            lattesId: parsedLattesId,
                            ...basicInfo,
                            ...projects,
                            ...events,
                            ...formations,
                            ...productions
                        };

                        const fileName = parsedLattesId;
                        saveJson(fullData, LATTES_DATA_DIR, fileName);
                        log.info(`✅ [Lattes] Sucesso: ${name} (ID: ${parsedLattesId})`);

                        if (targetLattesId && pipelineLogger) {
                            await pipelineLogger.pipelineLogItem(
                                pipelineLogId,
                                'PESQUISADOR_LATTES',
                                StatusItemLog.SUCESSO,
                                {
                                    entidadeId: parsedLattesId,
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

                if (success) {
                    break;
                }

                const nextPage = pageNumber + 1;
                const nextInicio = (nextPage - 1) * pagStatus.recordsPerPage;

                if (nextInicio < pagStatus.totalRecords) {
                    log.info(`[Lattes] ID não encontrado na página ${pageNumber} de ${totalPages}. Avançando para a página ${nextPage}...`);
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
                        page.evaluate((inicio) => {
                            (window as any).submeterPaginacao(inicio, 10);
                        }, nextInicio)
                    ]);
                    await sleep(1000);
                } else {
                    log.info(`[Lattes] Fim de todas as páginas de resultados (${totalPages}) alcançado sem encontrar o pesquisador.`);
                    break;
                }
            }

            if (!success && targetLattesId && pipelineLogger) {
                log.warning(`⚠️ [Lattes] Nenhum resultado coincidiram com o ID esperado (${targetLattesId}) para ${name}`);
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
            }
        },
    });

    await crawler.addRequests(targets.map(target => ({
        url: LATTES_URL,
        userData: { name: target.nome, targetLattesId: target.lattesId },
        uniqueKey: `LATTES-${target.lattesId || target.nome}`
    })));

    await crawler.run();
    log.info('[Lattes] Scraper Lattes finalizado.');

    if (!pipelineLoggerPrev && pipelineLogger && pipelineLogId) {
        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.CONCLUIDO);
    }
}
