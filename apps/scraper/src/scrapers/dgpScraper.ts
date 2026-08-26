import { PlaywrightCrawler, log } from 'crawlee';
import { BrowserContext, Page } from 'playwright';
import { DGPExtractor } from '../parsers/dgpParser';
import { db, prisma } from '../common/database';
import { saveJson, DGP_DATA_DIR } from '../common/config';
import { runLattesScraper } from './lattesScraper';
import { FilaExtracaoStatus, TipoErroColeta, StatusSessao, StatusItemLog, TipoEntidadeLog, ModuloSistema, ModoExecucao } from '@oda/database';
import { sleep, randomSleep } from '../common/utils';
import { SharedPipelineLogger } from '@oda/database';

const extractor = new DGPExtractor();
const pipelineLogger = new SharedPipelineLogger(prisma);

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

async function scrapeGroupPage(context: BrowserContext, groupPage: Page, coletaId: string, pipelineLogId: string | null) {
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

        // Cria map de detalhes do RH para cada pesquisador/líder do grupo
        const rhDetailsMap = new Map<string, ReturnType<typeof extractor.extractRHDetails>>();
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
                // Extração dos pesquisadores do grupo de pesquisa
                rhDetailsMap.set(nome || 'Desconhecido', extractor.extractRHDetails(html));
                await openedPopup.close();
            } catch (err: any) {
                log.error(`[Scraper] Erro ao extrair detalhes do RH para ${nome}: ${err.message}`);
                await pipelineLogger.pipelineLogItem(pipelineLogId, 'RH_DETALHES', StatusItemLog.ERRO, {
                    tipoEntidade: TipoEntidadeLog.GRUPO,
                    entidadeId: dgpId,
                    tipoErro: TipoErroColeta.DESCONHECIDO,
                    mensagemErro: `Erro ao extrair detalhes do RH para ${nome}: ${err.message}`,
                    detalhesErro: err.stack
                });
            } finally {
                await closePopup(activePopups, groupPage);
            }
        }

        const linesMap = new Map<string, ReturnType<typeof extractor.extractLineDetails>>();
        const linesButtons = await groupPage.$$("a[id*='idBtnVisualizarEspelhoLinhaPesquisa']");
        
        for (const btn of linesButtons) {
            await randomSleep(500, 1500);
            const linhaNome = await btn.evaluate(el => {
                const row = el.closest('tr');
                return row ? (row.querySelector('td')?.textContent || '').trim() : '';
            });
            try {
                const [openedPopup] = await Promise.all([
                    groupPage.waitForEvent('popup', { timeout: 20000 }),
                    btn.click(),
                ]);
                await openedPopup.waitForLoadState('domcontentloaded');
                await sleep(500);
                const html = await openedPopup.content();
                linesMap.set(linhaNome || "Desconhecido", extractor.extractLineDetails(html, linhaNome));
                await openedPopup.close();
            } catch(err: any){
                console.error(`[Scraper] Erro ao extrair detalhes da linha de pesquisa: ${err.message}`);
                await pipelineLogger.pipelineLogItem(pipelineLogId, 'LINHA_PESQUISA', StatusItemLog.ERRO, {
                    tipoEntidade: TipoEntidadeLog.GRUPO,
                    entidadeId: dgpId,
                    tipoErro: TipoErroColeta.DESCONHECIDO,
                    mensagemErro: `Erro ao extrair detalhes da linha de pesquisa ${linhaNome}: ${err.message}`,
                    detalhesErro: err.stack
                });
            } finally {
                await closePopup(activePopups, groupPage);
            }
        }

        const mainHtml = await groupPage.content();
        const data = extractor.extractGroupMirror(mainHtml, linesMap, rhDetailsMap);
        
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
        
        await pipelineLogger.pipelineLogItem(pipelineLogId, 'GRUPO_ESPELHO', StatusItemLog.SUCESSO, {
            tipoEntidade: TipoEntidadeLog.GRUPO,
            entidadeId: dgpId,
        });

    } catch (err: any) {
        log.error(`❌ Erro ao extrair grupo ${dgpId}: ${err.message}`);
        await pipelineLogger.pipelineLogItem(pipelineLogId, 'GRUPO_ESPELHO', StatusItemLog.ERRO, {
            tipoEntidade: TipoEntidadeLog.GRUPO,
            entidadeId: dgpId,
            mensagemErro: err.message,
            detalhesErro: err.stack
        });
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
            take: 10
        });
        pendingGroups = pending.map(p => ({ dgpId: p.dgpId, nome: p.nome }));
    }

    if (pendingGroups.length === 0) {
        log.info('[Scraper] Nenhum grupo pendente na fila.');
        return;
    }

    log.info(`[Scraper] Encontrados ${pendingGroups.length} grupos pendentes. Iniciando extração...`);

    const crawler = new PlaywrightCrawler({
        headless: true,
        maxConcurrency: 1, 
        requestHandlerTimeoutSecs: 3600, 
        browserPoolOptions: {
            useFingerprints: false,
            maxOpenPagesPerBrowser: 5,
            retireBrowserAfterPageCount: 15,
        }, 

        preNavigationHooks: [
            async ({ page }) => {
                const context = page.context();
                await context.route('**/*', (route) => {
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
            let pipelineLogId: string | null = null;
            
            try {
                await db.updateGroupQueueStatus(dgpId, FilaExtracaoStatus.PROCESSANDO);
                pipelineLogId = await pipelineLogger.startPipelineLogger(ModuloSistema.SCRAPER, dgpId, ModoExecucao.COMPLETA);
                await scrapeGroupPage(context, page, coletaId, pipelineLogId);
                await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.CONCLUIDO);
            } catch (error: any) {
                log.error(`[Scraper] Erro crítico no handler para o grupo '${dgpId}': ${error.message}`);
                await pipelineLogger.pipelineLogItem(pipelineLogId, 'scrapeGroupPage', StatusItemLog.ERRO, {
                    tipoEntidade: TipoEntidadeLog.GRUPO,
                    entidadeId: dgpId,
                    tipoErro: TipoErroColeta.DESCONHECIDO,
                    mensagemErro: error.message,
                    detalhesErro: JSON.stringify(error, Object.getOwnPropertyNames(error))
                });
                await db.updateGroupQueueStatus(dgpId, FilaExtracaoStatus.PENDENTE);
                await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.ERRO);
            }
        },
    });

    const requests = pendingGroups.map(group => ({
        url: `http://dgp.cnpq.br/dgp/espelhogrupo/${group.dgpId}`,
        userData: { dgpId: group.dgpId, coletaId: `DGP-EXTRACT-${group.dgpId}` },
        uniqueKey: `DGP-EXTRACT-${group.dgpId}`
    }));

    await crawler.addRequests(requests);
    await crawler.run();
    
    log.info('[Scraper] Extração DGP finalizada.');

    // Encadeamento sequencial para processar pesquisadores pendentes da fila
    const pendingResearchers = await prisma.filaExtracaoPesquisador.findMany({
        where: { status: FilaExtracaoStatus.PENDENTE }
    });
    if (pendingResearchers.length > 0) {
        log.info(`[Scraper] Iniciando extração Lattes sequencial para ${pendingResearchers.length} pesquisadores pendentes...`);
        const names = pendingResearchers.map(p => p.nome);
        await runLattesScraper(names);
    }
}
