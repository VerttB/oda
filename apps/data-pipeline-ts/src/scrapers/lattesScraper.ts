import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { LattesParser } from '../parsers/lattesParser';
import { saveJson, LATTES_DATA_DIR, IMAGE_DIR } from '../common/config';
import * as fs from 'fs';
import * as path from 'path';
import pLimit from 'p-limit'; // Precisará adicionar p-limit ou usar implementação custom

const parser = new LattesParser();
const LATTES_URL = "https://buscatextual.cnpq.br/buscatextual/busca.do";

async function downloadImage(url: string, name: string) {
    if (!url) return;
    try {
        const response = await fetch(url);
        if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const fileName = `${name.replace(/\s+/g, '_')}.webp`;
            if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
            fs.writeFileSync(path.join(IMAGE_DIR, fileName), buffer);
            console.log(`[Lattes] Imagem salva: ${fileName}`);
        }
    } catch (e) {
        console.warn(`[Lattes] Não foi possível baixar imagem de ${name}: ${e.message}`);
    }
}

async function searchAndExtractLattes(context: BrowserContext, page: Page, name: string) {
    try {
        console.log(`🔍 [Lattes] Buscando: ${name}`);
        await page.goto(LATTES_URL, { timeout: 60000 });
        
        await page.fill("input[id='textoBusca']", name);
        await page.click("input[id='buscarDemais']");
        await page.click("a[id='botaoBuscaFiltros']");
        
        await page.waitForSelector(".resultado", { timeout: 30000 });
        
        const firstResult = page.locator(".resultado b a").first();
        if (await firstResult.count() === 0) {
            console.warn(`⚠️ [Lattes] Nenhum resultado para ${name}`);
            return null;
        }
            
        await firstResult.click();
        await page.waitForSelector(".moldal-interna", { state: "visible", timeout: 15000 });

        const frame = page.frameLocator("iframe.iframe-modal");
        
        const [curriculoPage] = await Promise.all([
            context.waitForEvent('page', { timeout: 30000 }),
            frame.locator("a:has-text('Currículo Lattes')").evaluate(el => (el as HTMLElement).click())
        ]);

        await curriculoPage.waitForLoadState("domcontentloaded");
        const html = await curriculoPage.content();

        const basicInfo = parser.extractBasicInfo(html);
        const projects = parser.extractProjectDetails(html);
        const events = parser.extractEventDetails(html);
        
        // Imagem
        const photoUrl = parser.extractPhotoUrl(html);
        if (photoUrl) {
            await downloadImage(photoUrl, name);
        }
        
        const fullData = { ...basicInfo, ...projects, ...events };
        const fileName = name.replace(/\s+/g, '_');
        saveJson(fullData, LATTES_DATA_DIR, fileName);
        
        await curriculoPage.close();
        console.log(`✅ [Lattes] Sucesso: ${name}`);
        return fullData;

    } catch (e) {
        console.error(`❌ [Lattes] Erro ao processar ${name}: ${e.message}`);
        return null;
    }
}

async function worker(name: string, browser: Browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Otimização: Bloquear imagens e assets pesados
    await page.route("**/*", (route) => {
        if (["image", "stylesheet", "font"].includes(route.request().resourceType())) {
            route.abort();
        } else {
            route.continue();
        }
    });

    try {
        await searchAndExtractLattes(context, page, name);
    } finally {
        await context.close();
    }
}

export async function runLattesScraper(names: string[] = []) {
    if (!names || names.length === 0) {
        names = [
            "Eduardo Manuel de Freitas Jorge", 
            "Altemir José Mossi", 
            "Alfredo Castamann",
            "Eduardo Arthur Izycki",
            "Erika Stockler",
            "Alexandre Hugo Cezar Barros",
            "Ana Luiza du Bocage Neta",
            "Anália Carmem Silva de Almeida"
        ];
    }

    console.log(`🚀 Scraper Lattes iniciado para ${names.length} pesquisadores (Async + 2 Workers)`);
    
    const browser = await chromium.launch({ headless: true });
    
    // Concurrency limit mimicking Python's asyncio.Semaphore(2)
    const limit = pLimit(2);
    
    const tasks = names.map(name => limit(() => worker(name, browser)));
    await Promise.all(tasks);
    
    await browser.close();
    console.log('🏁 Scraper Lattes finalizado.');
}

