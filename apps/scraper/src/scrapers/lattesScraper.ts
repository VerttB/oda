import { PlaywrightCrawler, log } from 'crawlee';
import { Page } from 'playwright';
import { LattesParser } from '../parsers/lattesParser';
import { saveJson, LATTES_DATA_DIR, IMAGE_DIR } from '../common/config';
import { prisma, db } from '../common/database';
import { FilaExtracaoStatus, TipoErroColeta,StatusSessao, StatusItemLog, TipoEntidadeLog, ModuloSistema, ModoExecucao, SharedPipelineLogger } from '@oda/database';
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
            
            const totalRecords = totMatch ? parseInt(totMatch[1], 10) : 0;
            const recordsPerPage = regMatch ? parseInt(regMatch[1], 10) : 10;
            
            return {
                totalRecords,
                recordsPerPage,
                currentPage
            };
        });

        if (info) {
            const totalPages = Math.ceil(info.totalRecords / info.recordsPerPage);
            return {
                currentPage: info.currentPage,
                totalPages: totalPages || 1,
                totalRecords: info.totalRecords,
                recordsPerPage: info.recordsPerPage
            };
        }
    } catch (e: any) {
        log.warning(`[Lattes] Erro ao obter paginação: ${e.message}`);
    }
    return { currentPage: 1, totalPages: 1, totalRecords: 0, recordsPerPage: 10 };
}

async function downloadImage(url: string, lattesId: string) {
    if (!url) return;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const fileName = `${lattesId}.webp`;
            if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
            fs.writeFileSync(path.join(IMAGE_DIR, fileName), buffer);
            log.info(`[Lattes] Imagem salva: ${fileName}`);
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
    
    if(pipelineLoggerPrev){
        if(!dgpGrupo){ throw new Error("Para reutilizar logger, o parâmetro dgpGrupo deve ser fornecido."); }
        pipelineLogger = pipelineLoggerPrev;
    } else {
        pipelineLogger = new SharedPipelineLogger(prisma);
        pipelineLogger.startPipelineLogger(ModuloSistema.SCRAPER,"LATTES_EXTRACTION", ModoExecucao.APENAS_LATTES);
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
        },
        headless: true,
        maxConcurrency: 2, 
        requestHandlerTimeoutSecs: 1800,
        browserPoolOptions: {
            useFingerprints: false,
            maxOpenPagesPerBrowser: 5,
            retireBrowserAfterPageCount: 15,
        },

        preNavigationHooks: [
            async ({ page }) => {
                const context = page.context();
                await context.route("**/*", (route) => {
                    if (["image", "stylesheet", "font", "media"].includes(route.request().resourceType())) {
                        route.abort();
                    } else {
                        route.continue();
                    }
                });
            }
        ],

        async requestHandler({ page, request }) {
            const { name, label, targetLattesId, coletaId } = request.userData;
            const browserContext = page.context();
            const startTimer = performance.now();
            if (label === 'SEARCH') {
                log.info(`🔍 [Lattes] Buscando: ${name} (ID Esperado: ${targetLattesId || 'Qualquer um'})`);

                await page.goto(LATTES_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                await page.fill("input[id='textoBusca']", name);
                await page.click("input[id='buscarDemais']");
                await page.click("a[id='botaoBuscaFiltros']");
                
                try {
                    await page.waitForSelector(".resultado", { timeout: 40000 });
                } catch (e:any) {
                    log.warning(`⚠️ [Lattes] Pesquisador não encontrado: ${name}`);
                    if (targetLattesId) {
                        await pipelineLogger!.pipelineLogItem(
                            `Coleta Lattes - ${name}`,
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
                    const pageNumber = pagStatus.currentPage;
                    const totalPages = pagStatus.totalPages;

                    const results = page.locator(".resultado b a");
                    const count = await results.count();
                    log.info(`[Lattes] Página ${pageNumber} de ${totalPages}: Encontrados ${count} resultados para o nome ${name}`);

                    for (let i = 0; i < count; i++) {
                        const resultLink = results.nth(i);
                        const linkText = (await resultLink.textContent())?.trim() || "";

                        if (normalizeName(linkText) !== normalizeName(name)) {
                            log.info(`[Lattes] Nome no resultado "${linkText}" não corresponde exatamente a "${name}". Pulando...`);
                            continue;
                        }

                        log.info(`[Lattes] Verificando resultado ${i + 1} de ${count} na página ${pageNumber} de ${totalPages}: ${linkText}...`);
                        await resultLink.click();

                        try {
                            await page.waitForSelector(".moldal-interna", { state: "visible", timeout: 15000 });
                        } catch (e) {
                            log.warning(`⚠️ [Lattes] Modal de detalhes não abriu para o resultado ${i + 1}`);
                            continue;
                        }
                        const frame = page.frameLocator("iframe.iframe-modal");
                        const cvLink = frame.locator("a:has-text('Currículo Lattes')");

                        const activePopups = new Set<any>();
                        const popupListener = (p: any) => {
                            activePopups.add(p);
                            p.once('close', () => activePopups.delete(p));
                        };
                        page.on('popup', popupListener);

                        try {
                            const [openedPopup] = await Promise.all([
                                page.waitForEvent('popup', { timeout: 40000 }),
                                cvLink.evaluate(el => (el as HTMLElement).click()),
                            ]);

                            await openedPopup.waitForLoadState("domcontentloaded");
                            await sleep(500);
                            const html = await openedPopup.content();
                            const $ = cheerio.load(html);

                            const basicInfo = parser.extractBasicInfo($);
                            const parsedLattesId = basicInfo.lattes.replace(/https?:\/\/lattes\.cnpq\.br\//, '').trim();

                            log.info(`[Lattes] ID do Lattes analisado: ${parsedLattesId} (Esperado: ${targetLattesId || 'Qualquer'})`);

                            if (targetLattesId && parsedLattesId !== targetLattesId) {
                                log.warning(`[Lattes] ID do Lattes diferente do esperado. Fechando e tentando o próximo...`);
                                await openedPopup.close();
                                await closeModal(page);
                                continue;
                            }

                            const projects = parser.extractProjectDetails($);
                            const events = parser.extractEventDetails($);
                            const formations = parser.extractFormationDetails ? parser.extractFormationDetails($) : {};
                            const productions = parser.extractProductionDetails ? parser.extractProductionDetails($) : {};
                            
                            const photoUrl = parser.extractPhotoUrl($);
                            if (photoUrl) {
                                await downloadImage(photoUrl, parsedLattesId);
                            }
                            const endTimer = performance.now();
                            const tempoMs = endTimer - startTimer;

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
3
                            if (targetLattesId) {
                               //await db.logPesquisador(coletaId, targetLattesId, LogColetaStatus.SUCESSO);
                               await pipelineLogger!.pipelineLogItem(
                                    `Coleta Lattes - ${name}`,
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

                if (!success && targetLattesId) {
                    log.warning(`⚠️ [Lattes] Nenhum resultado coincidiu com o ID esperado (${targetLattesId}) para ${name}`);
                    const endTimer = performance.now();
                    const tempoMs = endTimer - startTimer;
                    await pipelineLogger!.pipelineLogItem(
                                `Coleta Lattes - ${name}`,
                                StatusItemLog.ERRO,
                                {
                                    entidadeId: targetLattesId || null,
                                    tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                                    tipoErro: TipoErroColeta.NAO_ENCONTRADO,
                                    mensagemErro: "Nenhum resultado coincidiu com o ID esperado (${targetLattesId}) para ${name}",
                                    tempoMs,
                                }
                            );
                }
            }
        },
    });

    await crawler.addRequests(targets.map(target => ({
        url: LATTES_URL,
        userData: { label: 'SEARCH', name: target.nome, targetLattesId: target.lattesId, coletaId: dgpGrupo || null },
        uniqueKey: `LATTES-${target.nome}-${target.lattesId}`
    })));

    await crawler.run();
    //await db.finishGrupoColeta(coletaId, targets.length);
    log.info('🏁 Scraper Lattes finalizado via Crawlee.');
}
