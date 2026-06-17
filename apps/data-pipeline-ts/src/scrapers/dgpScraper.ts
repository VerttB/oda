import { chromium, BrowserContext, Page } from 'playwright';
import { DGPExtractor } from '../parsers/dgpParser';
import { db } from '../common/database';
import { saveJson, DGP_DATA_DIR } from '../common/config';
import { log } from 'crawlee';

const extractor = new DGPExtractor();
const SEARCH_URL = 'http://dgp.cnpq.br/dgp/faces/consulta/consulta_parametrizada.jsf';

/**
 * Utilitário para atraso aleatório
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomSleep = (min: number, max: number) => sleep(Math.floor(Math.random() * (max - min + 1) + min));

/**
 * Executa o scraping completo de um grupo a partir de uma página já aberta.
 */
async function scrapeGroupPage(context: BrowserContext, groupPage: Page) {
    const url = groupPage.url();
    const match = url.match(/espelhogrupo\/(\d{16})/);
    const dgpId = match ? match[1] : null;

    if (!dgpId) {
        log.warning(`[Scraper] Não foi possível encontrar ID na URL: ${url}`);
        return;
    }

    log.info(`📄 Extraindo dados do Grupo ID: ${dgpId}`);

    try {
        await groupPage.waitForSelector('#recursosHumanos', { timeout: 30000 });
        await randomSleep(1000, 2000);

        // 1. Extrair detalhes dos membros (RH) via popups
        const rhDetailsMap = new Map<string, any>();
        const rhButtons = await groupPage.$$("a[id*='idBtnVisualizarEspelho']");
        
        for (const btn of rhButtons) {
            const nome = await btn.evaluate(el => {
                const row = el.closest('tr');
                return row ? (row.querySelector('td')?.textContent || '').trim() : '';
            });

            await randomSleep(500, 1500);
            const [popup] = await Promise.all([
                context.waitForEvent('page', { timeout: 20000 }),
                btn.click(),
            ]);
            await popup.waitForLoadState('domcontentloaded');
            const html = await popup.content();
            rhDetailsMap.set(nome || 'Desconhecido', extractor.extractRHDetails(html));
            await popup.close();
        }

        // 2. Extrair detalhes das linhas de pesquisa via popups
        const linesPopups: string[] = [];
        const linesButtons = await groupPage.$$("a[id*='idBtnVisualizarEspelhoLinhaPesquisa']");
        
        for (const btn of linesButtons) {
            await randomSleep(500, 1500);
            const [popup] = await Promise.all([
                context.waitForEvent('page', { timeout: 20000 }),
                btn.click(),
            ]);
            await popup.waitForLoadState('domcontentloaded');
            linesPopups.push(await popup.content());
            await popup.close();
        }

        const mainHtml = await groupPage.content();
        const data = extractor.extractGroupMirror(mainHtml, linesPopups, rhDetailsMap);
        
        // Garante que o ID extraído na extração bata com o da URL
        data.id_dgp = dgpId;

        saveJson(data, DGP_DATA_DIR, dgpId);
        log.info(`✅ Grupo ${dgpId} salvo com sucesso.`);
        
        // Opcional: registrar na fila como concluído para evitar re-processamento
        await db.queueDiscovery(dgpId);
        await db.updateQueueStatus(dgpId, 'CONCLUIDO');

    } catch (err) {
        log.error(`❌ Erro ao extrair grupo ${dgpId}: ${err.message}`);
        // Se falhar, salva na fila para tentar depois pelo serviço de retry
        await db.queueDiscovery(dgpId);
        await db.updateQueueStatus(dgpId, 'ERRO');
    }
}

/**
 * Scraper Unificado DGP.
 * Entra na busca e processa cada grupo clicando no link.
 */
export async function runDgpScraper() {
    const chavesVarredura = ["a", "e", "i", "o", "u"];

    log.info('🚀 Iniciando Scraper Unificado DGP (Clique Direto -> Extração)');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    
    const searchPage = await context.newPage();

    // Bloqueio de assets inúteis na busca
    await searchPage.route('**/*', (route) => {
        if (['image', 'font', 'stylesheet'].includes(route.request().resourceType())) return route.abort();
        return route.continue();
    });

    for (const chave of chavesVarredura) {
        log.info(`\n🔍 Buscando chave: '${chave.toUpperCase()}'`);
        
        try {
            await searchPage.goto(SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await randomSleep(2000, 3000);

            await searchPage.fill("input[id='idFormConsultaParametrizada:idTextoFiltro']", chave);
            await searchPage.click("button[id='idFormConsultaParametrizada:idPesquisar']");
            
            let hasNextPage = true;
            let pageNum = 1;

            while (hasNextPage) {
                log.info(`📍 Processando página ${pageNum} da chave '${chave}'`);
                await searchPage.waitForSelector(".itemConsulta", { timeout: 30000 });

                const links = searchPage.locator("a[id*='idBtnVisualizarEspelhoGrupo']");
                const count = await links.count();
                log.info(`Encontrados ${count} grupos na página.`);

                for (let i = 0; i < count; i++) {
                    const btn = links.nth(i);
                    
                    try {
                        log.info(`[${i+1}/${count}] Abrindo espelho do grupo...`);
                        await randomSleep(2000, 4000); // Delay entre grupos

                        const [groupPage] = await Promise.all([
                            context.waitForEvent('page', { timeout: 30000 }),
                            btn.click(),
                        ]);

                        await groupPage.waitForLoadState('domcontentloaded');
                        
                        // Extração imediata e salvamento
                        await scrapeGroupPage(context, groupPage);

                        await groupPage.close();
                    } catch (err) {
                        log.error(`Falha ao abrir grupo: ${err.message}`);
                    }
                }

                // Paginação
                const proximoBtn = searchPage.locator(".ui-paginator-next");
                if (await proximoBtn.count() > 0) {
                    const isDisabled = await proximoBtn.evaluate((el) => el.classList.contains('ui-state-disabled'));
                    if (!isDisabled) {
                        log.info('Avançando para a próxima página de resultados...');
                        await randomSleep(3000, 5000);
                        await proximoBtn.click();
                        await searchPage.waitForResponse(res => res.url().includes('consulta_parametrizada.jsf'));
                        pageNum++;
                    } else {
                        hasNextPage = false;
                    }
                } else {
                    hasNextPage = false;
                }
            }
        } catch (error) {
            log.error(`Erro na busca da chave '${chave}': ${error.message}`);
        }
    }

    await browser.close();
    log.info('🏁 Scraper DGP finalizado.');
}
