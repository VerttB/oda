import { PlaywrightCrawler, log } from 'crawlee';
import { LattesParser } from '../parsers/lattesParser';
import { saveJson, LATTES_DATA_DIR, IMAGE_DIR } from '../common/config';
import * as fs from 'fs';
import * as path from 'path';

const parser = new LattesParser();
const LATTES_URL = "https://buscatextual.cnpq.br/buscatextual/busca.do";

/**
 * Baixa a imagem do pesquisador conforme o original em Python.
 */
async function downloadImage(url: string, name: string) {
    if (!url) return;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const fileName = `${name.replace(/\s+/g, '_')}.webp`;
            fs.writeFileSync(path.join(IMAGE_DIR, fileName), buffer);
            log.info(`[Lattes] Imagem salva: ${fileName}`);
        }
    } catch (e) {
        log.warning(`[Lattes] Não foi possível baixar imagem de ${name}: ${e.message}`);
    }
}

/**
 * Scraper Lattes usando Crawlee para gestão de fila e anti-bloqueio.
 */
export async function runLattesScraper(names: string[] = []) {
    if (!names.length) {
        log.warning("[Lattes] Nenhum nome fornecido. Usando lista padrão de teste.");
        names = ["Eduardo Manuel de Freitas Jorge", "Altemir José Mossi", "Alfredo Castamann", "Eduardo Arthur Izycki", "Erika Stockler"];
    }

    log.info(`🚀 Iniciando Scraper Lattes para ${names.length} pesquisadores com Crawlee`);

    const crawler = new PlaywrightCrawler({
        headless: true,
        maxConcurrency: 1, // Um por vez para o Lattes (muito sensível)
        requestHandlerTimeoutSecs: 300,
        // useFingerprints: true,

        async requestHandler({ page, request }) {
            const { name, label } = request.userData;
            const browserContext = page.context()

            if (label === 'SEARCH') {
                log.info(`🔍 [Lattes] Buscando: ${name}`);
                await page.goto(LATTES_URL, { waitUntil: 'domcontentloaded' });
                
                await page.fill("input[id='textoBusca']", name);
                await page.click("input[id='buscarDemais']");
                await page.click("a[id='botaoBuscaFiltros']");
                
                try {
                    await page.waitForSelector(".resultado", { timeout: 30000 });
                } catch (e) {
                    log.warning(`⚠️ [Lattes] Pesquisador não encontrado: ${name}`);
                    return;
                }

                const firstResult = page.locator(".resultado b a").first();
                if (await firstResult.count() === 0) return;

                await firstResult.click();
                await page.waitForSelector(".moldal-interna", { state: "visible", timeout: 15000 });

                const frame = page.frameLocator("iframe.iframe-modal");
                const cvLink = frame.locator("a:has-text('Currículo Lattes')");

                const [popup] = await Promise.all([
                    browserContext.waitForEvent('page', { timeout: 30000 }),
                    cvLink.evaluate(el => (el as HTMLElement).click()),
                ]);

                await popup.waitForLoadState("domcontentloaded");
                const html = await popup.content();

                // Parsing
                const basicInfo = parser.extractBasicInfo(html);
                const projects = parser.extractProjectDetails(html);
                const events = parser.extractEventDetails(html);
                
                // Imagem
                const photoUrl = parser.extractPhotoUrl(html);
                if (photoUrl) {
                    await downloadImage(photoUrl, name);
                }

                const fullData = {
                    nome: name,
                    ...basicInfo,
                    ...projects,
                    ...events
                };

                const fileName = name.replace(/\s+/g, '_').toLowerCase();
                saveJson(fullData, LATTES_DATA_DIR, fileName);
                log.info(`✅ [Lattes] Sucesso: ${name}`);
                
                await popup.close();
            }
        },
    });

    await crawler.addRequests(names.map(name => ({
        url: LATTES_URL,
        userData: { label: 'SEARCH', name },
        uniqueKey: `LATTES-${name}`
    })));

    await crawler.run();
}
