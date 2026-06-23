import { PlaywrightCrawler, log } from 'crawlee';
import { db } from '../common/database';
import { randomSleep, sleep, cleanStr } from '../common/utils';
import { PageGroupItemInfo, RequestType } from '../common/interfaces';
import { Locator, Page } from 'playwright';
const SEARCH_URL = 'http://dgp.cnpq.br/dgp/faces/consulta/consulta_parametrizada.jsf';


// Cache global de metadados em memória RAM para evitar navegações duplicadas (exclusão global)
const processedKeys = new Set<string>();
// Cache de páginas processadas para evitar processar a mesma página duas vezes pelas duas direções
const processedPages = new Set<string>();
// Páginas em progresso
const processingPages = new Set<string>();
// Progresso atual da página
const requestPageProgress = new Map<string, number>();



let isCacheLoaded = false;

/** 
* 
* Carrega itens da fila de extração no banco em memória
*/
async function loadCacheIfNeeded() {
    if (isCacheLoaded) return;
    try {
        // Roda sempre para corrigir erros na coluna `similares`
        await db.normalizeQueueData();

        log.info("Carregando cache de itens já descobertos a partir do banco de dados...");
        const alreadyDiscovered = await db.getGroupQueueDiscovery();
        for (const item of alreadyDiscovered) {
            const key = `${cleanStr(item.nome)}|${cleanStr(item.area)}|${cleanStr(item.instituicao)}`;
            processedKeys.add(key);
        }
        isCacheLoaded = true;
        log.info(`Cache inicializado com ${processedKeys.size} itens do banco.`);
    } catch (err: any) {
        log.error(`Erro ao carregar cache do banco: ${err.message}`);
    }
}


async function isLoginRedirect(page: Page): Promise<boolean> {
    try {
        const url = page.url();
        const title = (await page.title().catch(() => "")).toLowerCase();
        return url.includes('login') || title.includes('login');
    } catch (e) {
        return false;
    }
}

async function handleNotDisabled(page: Page, btn: Locator){
    const firstItemBefore = await page.locator("li.ui-datalist-item").first().textContent();
    await btn.click();
    await page.waitForFunction((prev: string | null) => {
        const firstItem = document.querySelector("li.ui-datalist-item");
        return firstItem && firstItem.textContent !== prev;
    }, firstItemBefore, { timeout: 40000 });
}

async function handleSessionRecovery(page: any, chave: string, pageNum: number, direction: string, message: string) {
    log.warning(`⚠️ [${direction.toUpperCase()}] ${message}. Recuperando sessão em 1 minuto...`);
    await sleep(60000);
    await prepareSearchPage(page, chave, pageNum, direction);
}

/**
 * Reconecta ao portal do DGP, refaz a pesquisa e navega até a página de listagem correta.
 * Utilizado para recuperar a sessão em caso de expiração ou redirecionamento para o login.
 */
async function prepareSearchPage(page: Page, chave: string, pageNum: number, direction: string): Promise<number> {
    let success = false;
    let attempts = 0;
    let finalPageNum = pageNum;
    
    while (!success && attempts < 3) {
        try {
            log.info(`🔄 [${direction.toUpperCase()}] Preparando página de busca: Chave '${chave}', Página ${pageNum} (Tentativa ${attempts + 1})`);
            
            await page.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await randomSleep(2000, 4000);

            // Verifica redirecionamento para login
            if (await isLoginRedirect(page)) {
                log.warning(`⚠️ [${direction.toUpperCase()}] Página de busca principal redirecionada para login. Aguardando 1 minuto...`);
                await sleep(60000);
                attempts++;
                continue;
            }

            await page.fill("input[id='idFormConsultaParametrizada:idTextoFiltro']", chave);
            await page.getByLabel("Não-atualizado").uncheck()
            await randomSleep(1000,2000)
            await page.click("button[id='idFormConsultaParametrizada:buscaRefinada']")
            await page.waitForSelector("label.ui-selectonemenu-label")

            // Seleciona Região
            await randomSleep(500,1500)
            await page.locator("div[id='idFormConsultaParametrizada:idRegiao']")
            await page.locator("ul.ui-selectonemenu-items li").getByText("Nordeste", { exact: true }).click();

          
            await page.waitForLoadState('networkidle');

        
            //Seleciona UF
            await page.locator("div[id='idFormConsultaParametrizada:idUF']").click();
            await page.locator("ul.ui-selectonemenu-items li").getByText("Bahia", { exact: true }).click();

            
            await page.click("button[id='idFormConsultaParametrizada:idPesquisar']");
            await page.waitForLoadState('networkidle');
            await page.waitForSelector("li.ui-datalist-item", { timeout: 40000 });
            
            // Configura para exibir 100 itens
            await page.locator(".ui-paginator-rpp-options").selectOption({ index: 2 });                
            await page.waitForLoadState('networkidle'); 
            await sleep(10000)

            if (direction === 'backward') {
                if (pageNum === 1) {
                    // Vai para a última página pela primeira vez
                    const lastBtn = page.locator(".ui-paginator-last");
                    const isDisabled = await lastBtn.evaluate((el: Element) => el.classList.contains('ui-state-disabled'));
                    if (!isDisabled) {
                       await handleNotDisabled(page, lastBtn);
                    }
                    const activePageText = await page.locator(".ui-paginator-page.ui-state-active").first().textContent();
                    finalPageNum = parseInt(activePageText || "1", 10);
                    log.info(`🎯 [BACKWARD] Última página identificada: ${finalPageNum}`);
                } else {
                    // Vai para a última página e retrocede até pageNum
                    const lastBtn = page.locator(".ui-paginator-last");
                    const isDisabled = await lastBtn.evaluate((el: Element) => el.classList.contains('ui-state-disabled'));
                    if (!isDisabled) {
                        await handleNotDisabled(page, lastBtn);
                    }
                    
                    let currentP = parseInt(await page.locator(".ui-paginator-page.ui-state-active").first().textContent() || "1", 10);
                    while (currentP > pageNum) {
                        const anteriorBtn = page.locator(".ui-paginator-prev");
                        const isPrevDisabled = await anteriorBtn.evaluate((el: Element) => el.classList.contains('ui-state-disabled'));
                        if (isPrevDisabled) break;
                        
                        await handleNotDisabled(page, anteriorBtn);
                        currentP--;
                    }
                    finalPageNum = pageNum;
                }
            } else {
                // Modo FORWARD: Avança as páginas até atingir o pageNum correto
                let currentP = 1;
                while (currentP < pageNum) {
                    const proximoBtn = page.locator(".ui-paginator-next");
                    const isDisabled = await proximoBtn.evaluate((el: Element) => el.classList.contains('ui-state-disabled'));
                    if (isDisabled) break;
                    
                    await handleNotDisabled(page, proximoBtn);
                    currentP++;
                }
                finalPageNum = pageNum;
            }
            success = true;
        } catch (err: any) {
            log.error(`[${direction.toUpperCase()}] Erro ao preparar página de busca (Tentativa ${attempts + 1}): ${err.message}`);
            if (page.isClosed()) {
                throw new Error("Page was closed. Aborting prepareSearchPage retry loop.");
            }
            attempts++;
            if (attempts < 3) {
                log.info("⏳ Aguardando 10 segundos antes de tentar novamente...");
                await sleep(10000);
            }
        }
    }
    if (!success) {
        throw new Error(`Falha crítica ao preparar a página de busca para a chave '${chave}', página ${pageNum}.`);
    }
    return finalPageNum;
}

export async function runDgpDiscovery(keys: string[] = ["a", "e", "i", "o", "u"]) {
    log.info(`Iniciando Discovery DGP para as chaves: ${keys.join(', ')}`);

    await loadCacheIfNeeded();
    const initialCacheSize = processedKeys.size;

    const concurrency = Math.min(Math.max(2, keys.length * 2), 8);
    log.info(`Configurando crawler com ${concurrency} workers concorrentes.`);

    const crawler = new PlaywrightCrawler({
        launchContext: {
            useIncognitoPages: true,
        },
        headless: true,
        maxConcurrency: concurrency,
        minConcurrency: concurrency,
        requestHandlerTimeoutSecs: 5000,

        preNavigationHooks: [
            async ({ page }) => {
                await page.route('**/*', (route) => {
                    if (['image', 'font', 'stylesheet', 'media'].includes(route.request().resourceType())) {
                        return route.abort();
                    }
                    return route.continue();
                });
            }
        ],

        async requestHandler({ page, request  }) {
            const chave = request.userData.chave;
            const direction = request.userData.direction || 'forward';
            log.info(`\n Descobrindo grupos para a chave: '${chave.toUpperCase()}' em direção [${direction.toUpperCase()}]`);
            
            const activePopups = new Set<any>();
            const popupListener = (p: any) => {
                activePopups.add(p);
                p.once('close', () => activePopups.delete(p));
            };
            page.on('popup', popupListener);

            const progressKey = `${chave}|${direction}`;
            let pageNum = requestPageProgress.get(progressKey) || 1;

            try {
                let hasNextPage = true;

                // Inicializa a sessão de busca e define a página inicial de cada direção
                pageNum = await prepareSearchPage(page, chave, pageNum, direction);
                
                while (hasNextPage) {
                    const pageKey = `${chave}|${pageNum}`;
                    if (processedPages.has(pageKey) || processingPages.has(pageKey)) {
                        log.info(`⏭️ [${direction.toUpperCase()}] Página ${pageNum} já está sendo ou já foi processada pela outra direção. Parando crawler.`);
                        hasNextPage = false;
                        break;
                    }
                    processingPages.add(pageKey);

                    if (await isLoginRedirect(page)) {
                        await handleSessionRecovery(page, chave, pageNum, direction, `Login detectado no início da página ${pageNum}`);
                    }

                    log.info(`📍 [${direction.toUpperCase()}] Processando página ${pageNum} da chave '${chave}'`);
                    await page.waitForSelector("li.ui-datalist-item a[id*='idBtnVisualizarEspelhoGrupo']", { timeout: 40000 });
                    
                    const items = await page.locator("li.ui-datalist-item").all();
                    const totalItems = items.length;
                    log.info(`[${direction.toUpperCase()}] Total de Grupos nessa página: ${totalItems}`);

                    // Cache de processados local desta página específica
                    const pageProcessedKeys = new Set<string>();

                    // 1. MAPEAMENTO DE ITENS DA PÁGINA ATUAL EM UM ÚNICO EVALUATE (Super Rápido)
                    const pageItems: PageGroupItemInfo[] = await page.evaluate(() => {
                        const cleanStrLocal = (s: string | null | undefined): string => {
                            if (!s) return '';
                            return s.replace(/\s+/g, ' ').trim();
                        };
                        const elements = document.querySelectorAll("li.ui-datalist-item");
                        const results: any[] = [];
                        elements.forEach((el) => {
                            const btn = el.querySelector('a[id*="idBtnVisualizarEspelhoGrupo"]');
                            const nome = btn ? (btn.textContent || '').trim() : '';
                            
                            let instituicao = '';
                            let area = '';
                            
                            const labels = el.querySelectorAll('label');
                            labels.forEach(lbl => {
                                const text = lbl.textContent || '';
                                if (text.indexOf('Instituição') !== -1) {
                                    const valDiv = lbl.nextElementSibling;
                                    if (valDiv) instituicao = (valDiv.textContent || '').trim();
                                } else if (text.indexOf('Área') !== -1) {
                                    const valDiv = lbl.nextElementSibling;
                                    if (valDiv) area = (valDiv.textContent || '').trim();
                                }
                            });
                            
                            const cleanNome = cleanStrLocal(nome);
                            const cleanArea = cleanStrLocal(area);
                            const cleanInstituicao = cleanStrLocal(instituicao);
                            const key = `${cleanNome}|${cleanArea}|${cleanInstituicao}`;
                            results.push({ nome: cleanNome, area: cleanArea, instituicao: cleanInstituicao, key });
                        });
                        return results;
                    });

                    // 2. PRÉ-ANÁLISE DE DUPLICADOS NA PÁGINA INTEIRA (Corrigindo o bug do 'item.key'):
                    const keyCounts = new Map<string, number>();
                    for (const item of pageItems) {
                        keyCounts.set(item.key, (keyCounts.get(item.key) || 0) + 1);
                    }

                    // Helper to process a single item index
                    const processItem = async (index: number): Promise<void> => {
                        const { nome, area, instituicao, key } = pageItems[index];
                        let itemSuccess = false;
                        let itemAttempts = 0;

                        while (!itemSuccess && itemAttempts < 3) {
                            try {
                                const itemLocator = page.locator("li.ui-datalist-item").nth(index);
                                const btn = itemLocator.locator('a[id*="idBtnVisualizarEspelhoGrupo"]').first();
                                
                                await randomSleep(250, 500);

                                const [openedPage] = await Promise.all([
                                    page.waitForEvent('popup', { timeout: 20000 }),
                                    btn.click({ force: true})
                                ]);

                                await openedPage.waitForLoadState('domcontentloaded');
                                await sleep(500);

                                if (await isLoginRedirect(openedPage)) {
                                    await openedPage.close();
                                    await handleSessionRecovery(page, chave, pageNum, direction, `Redirecionado para login no popup do item ${index + 1} (${nome})`);
                                    itemAttempts++;
                                    continue;
                                }

                                await openedPage.waitForSelector("div:has-text('espelhogrupo')", { timeout: 15000 });
                                const text = await openedPage.locator("div:has-text('espelhogrupo')").first().textContent();
                                const dgpId = text?.match(/espelhogrupo\/(\d+)/)?.[1] || "";                          
                                await db.groupQeueDiscovery({ dgpId, nome, area, instituicao});
                                await openedPage.close();
                                itemSuccess = true;
                            } catch (itemErr: any) {
                                log.error(`Tentativa ${itemAttempts + 1} falhou para o item ${index + 1} (${nome}): ${itemErr.message}`);
                                if (await isLoginRedirect(page)) {
                                    await handleSessionRecovery(page, chave, pageNum, direction, "Sessão principal perdida (login detectado)");
                                }

                                itemAttempts++;
                                if (itemAttempts >= 3) {
                                    processedKeys.delete(key);
                                    pageProcessedKeys.delete(key);
                                    throw itemErr;
                                }
                            } finally {
                                for (const p of activePopups) {
                                    if (p !== page) {
                                        try {
                                            await p.close();
                                        } catch (closeErr) {}
                                    }
                                }
                                activePopups.clear();
                            }
                        }
                    };

                    // Gera os índices com base na direção
                    const indices = direction === 'forward'
                        ? Array.from({ length: totalItems }, (_, i) => i)
                        : Array.from({ length: totalItems }, (_, i) => totalItems - 1 - i);

                    const normalIndices: number[] = [];
                    const specialIndices: number[] = [];

                    for (const index of indices) {
                        const { key } = pageItems[index];
                        const isBoundary = index < 3 || index >= totalItems - 3;
                        const hasInternalDuplicates = (keyCounts.get(key) || 0) > 1;

                        if (isBoundary || hasInternalDuplicates) {
                            specialIndices.push(index);
                        } else {
                            normalIndices.push(index);
                        }
                    }

                    let skippedCount = 0;

                    // A. PROCESSA PRIMEIRO OS ITENS NORMAIS (Não boundaries, não duplicados)
                    for (const index of normalIndices) {
                        const { key } = pageItems[index];
                        if (processedKeys.has(key) && !pageProcessedKeys.has(key)) {
                            skippedCount++;
                            continue;
                        }
                        processedKeys.add(key);
                        pageProcessedKeys.add(key);
                        await processItem(index);
                    }

                    // B. PROCESSA DEPOIS OS ITENS ESPECIAIS (Boundaries e duplicados)
                    for (const index of specialIndices) {
                        const { key } = pageItems[index];
                        processedKeys.add(key);
                        pageProcessedKeys.add(key);
                        await processItem(index);
                    }

                    // Adiciona a página concluída ao cache de páginas processadas
                    processedPages.add(pageKey);

                    log.info(`📊 [${direction.toUpperCase()}] Página ${pageNum} concluída. Itens pulados por já estarem no cache: ${skippedCount}. Total acumulado de itens cacheados: ${processedKeys.size}.`);

                    // Navega para a próxima/anterior página
                    const btnSelector = direction === 'forward' ? ".ui-paginator-next" : ".ui-paginator-prev";
                    const pageBtn = page.locator(btnSelector);
                    if (await pageBtn.count() > 0) {
                        const isDisabled = await pageBtn.evaluate((el) => el.classList.contains('ui-state-disabled'));
                        if (!isDisabled) {
                            await randomSleep(1000, 2000);
                            await handleNotDisabled(page, pageBtn);
                            
                            if (direction === 'forward') {
                                pageNum++;
                            } else {
                                pageNum--;
                            }
                            requestPageProgress.set(progressKey, pageNum);
                        } else {
                            hasNextPage = false;
                        }
                    } else {
                        hasNextPage = false;
                    }
                }
            } catch (error: any) {
                log.error(`Erro na busca da chave '${chave}' [${direction}]: ${error.message}`);
                throw error;
            } finally {
                // Remove a página atual de ambos os caches em caso de erro,
                // garantindo que a retentativa possa processar o canal livremente.
                const pageKey = `${chave}|${pageNum}`;
                processingPages.delete(pageKey);
                processedPages.delete(pageKey);

                page.off('popup', popupListener);
                for (const p of activePopups) {
                    try {
                        await p.close();
                    } catch (closeErr) {}
                }
                activePopups.clear();
                try {
                    await page.close();
                } catch (closeErr) {}
            }
        },
    });
    

    const requests:RequestType[] = [];
    for (const chave of keys) {
        requests.push({
            url: SEARCH_URL,
            userData: { chave, direction: 'forward' },
            uniqueKey: `DGP-DISCOVERY-${chave}-FORWARD`
        });
        requests.push({
            url: SEARCH_URL,
            userData: { chave, direction: 'backward' },
            uniqueKey: `DGP-DISCOVERY-${chave}-BACKWARD`
        });
    }

    await crawler.addRequests(requests);
    await crawler.run();

    log.info("Recalculating column 'similares' in database...");
    await db.normalizeQueueData();

    const finalCacheSize = processedKeys.size;
    const newlyDiscovered = finalCacheSize - initialCacheSize;
    log.info(`🏁 Discovery DGP finalizado. Total de itens cacheados: ${finalCacheSize} (Novos itens descobertos e cacheados nesta rodada: ${newlyDiscovered}).`);
}
