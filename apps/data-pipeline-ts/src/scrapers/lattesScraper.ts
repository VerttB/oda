import { PlaywrightCrawler, log } from 'crawlee';
import { Page } from 'playwright';
import { LattesParser } from '../parsers/lattesParser';
import { saveJson, LATTES_DATA_DIR, IMAGE_DIR } from '../common/config';
import { prisma, db } from '../common/database';
import { FilaExtracaoStatus, LogColetaStatus } from '@oda/database';
import * as fs from 'fs';
import * as path from 'path';

const parser = new LattesParser();
const LATTES_URL = "https://buscatextual.cnpq.br/buscatextual/busca.do";
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImage(url: string, name: string) {
    if (!url) return;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const fileName = `${name.replace(/\s+/g, '_')}.webp`;
            if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
            fs.writeFileSync(path.join(IMAGE_DIR, fileName), buffer);
            log.info(`[Lattes] Imagem salva: ${fileName}`);
        }
    } catch (e: any) {
        log.warning(`[Lattes] Não foi possível baixar imagem de ${name}: ${e.message}`);
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

export async function runLattesScraper(names: string[] = []) {
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

    // Inicializa a Coleta Scraper global
    const coleta = await db.startScrapperColeta('LATTES');
    const coletaId = coleta.id;

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
        requestHandlerTimeoutSecs: 300,

        preNavigationHooks: [
            async ({ page }) => {
                await page.route("**/*", (route) => {
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

            if (label === 'SEARCH') {
                log.info(`🔍 [Lattes] Buscando: ${name} (ID Esperado: ${targetLattesId || 'Qualquer um'})`);

                await page.goto(LATTES_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                await page.fill("input[id='textoBusca']", name);
                await page.click("input[id='buscarDemais']");
                await page.click("a[id='botaoBuscaFiltros']");
                
                try {
                    await page.waitForSelector(".resultado", { timeout: 30000 });
                } catch (e) {
                    log.warning(`⚠️ [Lattes] Pesquisador não encontrado: ${name}`);
                    if (targetLattesId) {
                        await db.logPesquisador(coletaId, targetLattesId, LogColetaStatus.ERRO);
                    }
                    return;
                }

                let success = false;
                let pageNumber = 1;

                while (true) {
                    const results = page.locator(".resultado b a");
                    const count = await results.count();
                    log.info(`[Lattes] Página ${pageNumber}: Encontrados ${count} resultados para o nome ${name}`);

                    for (let i = 0; i < count; i++) {
                        log.info(`[Lattes] Verificando resultado ${i + 1} de ${count} na página ${pageNumber}...`);
                        const resultLink = results.nth(i);
                        console.log(await resultLink.textContent())
                        await resultLink.click();

                        try {
                            await page.waitForSelector(".moldal-interna", { state: "visible", timeout: 15000 });
                        } catch (e) {
                            log.warning(`⚠️ [Lattes] Modal de detalhes não abriu para o resultado ${i + 1}`);
                            continue;
                        }
                        const frame = page.frameLocator("iframe.iframe-modal");
                        const cvLink = frame.locator("a:has-text('Currículo Lattes')");

                        const [popup] = await Promise.all([
                            browserContext.waitForEvent('page', { timeout: 30000 }),
                            cvLink.evaluate(el => (el as HTMLElement).click()),
                        ]);

                        if (await cvLink.count() === 0) {
                            log.warning(`⚠️ [Lattes] Link do currículo não encontrado no resultado ${i + 1}`);
                            await closeModal(page);
                            continue;
                        }

                        const activePopups = new Set<any>();
                        activePopups.add(popup)
                        const popupListener = (p: any) => {
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

                            const basicInfo = parser.extractBasicInfo(html);
                            const parsedLattesId = basicInfo.lattes.replace(/https?:\/\/lattes\.cnpq\.br\//, '').trim();

                            log.info(`[Lattes] ID do Lattes analisado: ${parsedLattesId} (Esperado: ${targetLattesId || 'Qualquer'})`);

                            if (targetLattesId && parsedLattesId !== targetLattesId) {
                                log.warning(`[Lattes] ID do Lattes diferente do esperado. Fechando e tentando o próximo...`);
                                await openedPopup.close();
                                await closeModal(page);
                                continue;
                            }

                            const projects = parser.extractProjectDetails(html);
                            const events = parser.extractEventDetails(html);
                            const formations = parser.extractFormationDetails ? parser.extractFormationDetails(html) : {};
                            const productions = parser.extractProductionDetails ? parser.extractProductionDetails(html) : {};
                            
                            const photoUrl = parser.extractPhotoUrl(html);
                            if (photoUrl) {
                                await downloadImage(photoUrl, name);
                            }

                            const fullData = {
                                nome: name,
                                lattesId: parsedLattesId,
                                ...basicInfo,
                                ...projects,
                                ...events,
                                ...formations,
                                ...productions
                            };

                            const fileName = name.replace(/\s+/g, '_').toLowerCase();
                            saveJson(fullData, LATTES_DATA_DIR, fileName);
                            log.info(`✅ [Lattes] Sucesso: ${name} (ID: ${parsedLattesId})`);

                            if (targetLattesId) {
                                await db.logPesquisador(coletaId, targetLattesId, LogColetaStatus.SUCESSO);
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

                    const nextButton = page.locator('a:has-text("próximo")');
                    if (await nextButton.count() > 0) {
                        log.info(`[Lattes] ID não encontrado nesta página. Avançando para a próxima página de resultados...`);
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
                            nextButton.first().click()
                        ]);
                        pageNumber++;
                        await sleep(1000);
                    } else {
                        log.info(`[Lattes] Fim de todas as páginas de resultados alcançado sem encontrar o pesquisador.`);
                        break;
                    }
                }

                if (!success && targetLattesId) {
                    log.warning(`⚠️ [Lattes] Nenhum resultado coincidiu com o ID esperado (${targetLattesId}) para ${name}`);
                    await db.logPesquisador(coletaId, targetLattesId, LogColetaStatus.ERRO);
                }
            }
        },
    });

    await crawler.addRequests(targets.map(target => ({
        url: LATTES_URL,
        userData: { label: 'SEARCH', name: target.nome, targetLattesId: target.lattesId, coletaId },
        uniqueKey: `LATTES-${target.nome}-${target.lattesId}`
    })));

    await crawler.run();
    await db.finishGrupoColeta(coletaId, targets.length);
    log.info('🏁 Scraper Lattes finalizado via Crawlee.');
}
