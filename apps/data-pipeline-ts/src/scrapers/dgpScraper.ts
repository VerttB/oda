import { PlaywrightCrawler, log } from 'crawlee';
import { BrowserContext, Page } from 'playwright';
import { DGPExtractor } from '../parsers/dgpParser';
import { db, prisma } from '../common/database';
import { saveJson, DGP_DATA_DIR } from '../common/config';
import { runLattesScraper } from './lattesScraper';
import { FilaExtracaoStatus, LogColetaStatus } from '@oda/database';
import { sleep, randomSleep } from '../common/utils';
const extractor = new DGPExtractor();

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

async function scrapeGroupPage(context: BrowserContext, groupPage: Page, coletaId: string) {
    const url = groupPage.url();
    const match = url.split("/");
    const dgpId = match[match.length-1];
    
    if (!dgpId) {
        log.warning(`[Scraper] Não foi possível encontrar ID na URL: ${url}`);
        return;
    }

    log.info(`[Scraper] Extraindo dados detalhados do Grupo ID: ${dgpId}`);

    const activePopups = new Set<Page>();
    const popupListener = (p: Page) => {
        activePopups.add(p);
        p.once('close', () => activePopups.delete(p));
    };
    groupPage.on('popup', popupListener);

    try {
        await groupPage.waitForSelector('#recursosHumanos', { timeout: 30000 });
        await randomSleep(1000, 2000);

        const rhDetailsMap = new Map<string, any>();
        const rhButtons = await groupPage.$$("a[id*='idBtnVisualizarEspelho']");
        
        for (const btn of rhButtons) {
            const nome = await btn.evaluate(el => {
                const row = el.closest('tr');
                return row ? (row.querySelector('td')?.textContent || '').trim() : '';
            });

            await randomSleep(500, 1500);
            try {
                const [openedPopup] = await Promise.all([
                    groupPage.waitForEvent('popup', { timeout: 20000 }),
                    btn.click(),
                ]);
                await openedPopup.waitForLoadState('domcontentloaded');
                await sleep(500);
                const html = await openedPopup.content();
                rhDetailsMap.set(nome || 'Desconhecido', extractor.extractRHDetails(html));
                await openedPopup.close();
            } finally {
                await closePopup(activePopups, groupPage)
            }
        }

        const linesPopups: string[] = [];
        const linesButtons = await groupPage.$$("a[id*='idBtnVisualizarEspelhoLinhaPesquisa']");
        
        for (const btn of linesButtons) {
            await randomSleep(500, 1500);
            try {
                const [openedPopup] = await Promise.all([
                    groupPage.waitForEvent('popup', { timeout: 20000 }),
                    btn.click(),
                ]);
                await openedPopup.waitForLoadState('domcontentloaded');
                await sleep(500);
                linesPopups.push(await openedPopup.content());
                await openedPopup.close();
            } finally {
                await closePopup(activePopups, groupPage)
            }
        }

        const mainHtml = await groupPage.content();
        const data = extractor.extractGroupMirror(mainHtml, linesPopups, rhDetailsMap);
        
        data.id_dgp = dgpId;
        saveJson(data, DGP_DATA_DIR, dgpId);
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
        
        await db.logGrupo(coletaId, dgpId, LogColetaStatus.SUCESSO);

        if (pesquisadoresParaScrapear.length > 0) {
            log.info(`[Scraper] Iniciando extração Lattes para ${pesquisadoresParaScrapear.length} pesquisadores pendentes do grupo ${dgpId}...`);
            await runLattesScraper(pesquisadoresParaScrapear);
        }

    } catch (err: any) {
        log.error(`❌ Erro ao extrair grupo ${dgpId}: ${err.message}`);
        await db.logGrupo(coletaId, dgpId, LogColetaStatus.ERRO);
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
        // Se IDs específicos foram fornecidos, garante que existem na fila e os seleciona
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
            take: 50 
        });
        pendingGroups = pending.map(p => ({ dgpId: p.dgpId, nome: p.nome }));
    }

    if (pendingGroups.length === 0) {
        log.info('[Scraper] Nenhum grupo pendente na fila.');
        return;
    }

    log.info(`[Scraper] Encontrados ${pendingGroups.length} grupos pendentes. Iniciando extração...`);

    const coleta = await db.startScrapperColeta('DGP');
    const coletaId = coleta.id;

    const crawler = new PlaywrightCrawler({
        headless: true,
        maxConcurrency: 1, 
        requestHandlerTimeoutSecs: 3600, 

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

        async requestHandler({ page, request }) {
            const context = page.context();
            const dgpId = request.url.split("/").pop();
            const { coletaId } = request.userData;
            
            if (!dgpId) return;

            log.info(`\n🔍 Processando Grupo: ${dgpId}`);
            
            try {
                await db.updateGroupQueueStatus(dgpId, FilaExtracaoStatus.PROCESSANDO);
                await scrapeGroupPage(context, page, coletaId);
            } catch (error: any) {
                log.error(`[Scraper] Erro crítico no handler para o grupo '${dgpId}': ${error.message}`);
                await db.logGrupo(coletaId, dgpId, LogColetaStatus.ERRO);
            }
        },
    });

    const requests = pendingGroups.map(group => ({
        url: `http://dgp.cnpq.br/dgp/espelhogrupo/${group.dgpId}`,
        userData: { coletaId },
        uniqueKey: `DGP-EXTRACT-${group.dgpId}`
    }));

    await crawler.addRequests(requests);
    await crawler.run();
    
    await db.finishGrupoColeta(coletaId, pendingGroups.length);
    log.info('[Scraper] Extração DGP finalizada.');
}
