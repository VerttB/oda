import * as path from 'path';
import * as fs from 'fs';
import { Configuration, purgeDefaultStorages } from 'crawlee';
import type { PlaywrightCrawlerOptions } from 'crawlee';
import type { BrowserContext } from 'playwright';

// Limites operacionais ficam em codigo ate termos medidas de uma coleta prolongada.
export const SCRAPER_SETTINGS = {
    lattes: { take: 500, batchSize: 15, maxConcurrency: 1, requestHandlerTimeoutSecs: 300, maxRequestRetries: 3 },
    dgp: { take: 200, maxConcurrency: 1, requestHandlerTimeoutSecs: 3600, maxRequestRetries: 3, maxRecoveriesPerGroup: 10, loginRetryDelayMs: 60000 },
    discovery: { maxConcurrency: 4, requestHandlerTimeoutSecs: 5000 },
};
export const LATTES_URL = 'https://buscatextual.cnpq.br/buscatextual/busca.do';

export const DGP_TIMEOUTS = {
    popupMs: 30000,
    detailMs: 45000,
    mirrorMs: 60000,
};

const routedContexts = new WeakSet<BrowserContext>();

export function createCrawlerOptions(name: CrawlerStorageName, keyCount = 1): PlaywrightCrawlerOptions {
    const settings = SCRAPER_SETTINGS[name];
    const maxConcurrency = name === 'discovery'
        ? Math.min(Math.max(2, keyCount * 2), settings.maxConcurrency)
        : settings.maxConcurrency;
    // O Lattes depende do CSS para a visibilidade dos modais e dos botoes.
    const blockedResources = new Set(name === 'lattes'
        ? ['image', 'font', 'media']
        : ['image', 'font', 'stylesheet', 'media']);
    return {
        headless: true,
        maxConcurrency,
        requestHandlerTimeoutSecs: settings.requestHandlerTimeoutSecs,
        ...(name === 'lattes'
            ? { maxRequestRetries: SCRAPER_SETTINGS.lattes.maxRequestRetries }
            : name === 'dgp'
                ? { maxRequestRetries: SCRAPER_SETTINGS.dgp.maxRequestRetries }
                : {}),
        launchContext: {
            useIncognitoPages: true,
            ...(name === 'lattes' ? {
                launchOptions: { args: ['--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'] },
            } : {}),
        },
        browserPoolOptions: {
            useFingerprints: name !== 'dgp',
            maxOpenPagesPerBrowser: name === 'lattes' ? 1 : 5,
            retireBrowserAfterPageCount: name === 'lattes' ? 5 : 15,
            ...(name === 'lattes' ? {
                fingerprintOptions: {
                    fingerprintGeneratorOptions: { browsers: ['chrome' as const], devices: ['desktop' as const], operatingSystems: ['windows' as const] },
                },
            } : {}),
        },
        preNavigationHooks: [async ({ page }, gotoOptions) => {
            // O espelho DGP precisa concluir o carregamento antes da leitura dos detalhes.
            gotoOptions.waitUntil = name === 'dgp' ? 'load' : 'domcontentloaded';
            const context = page.context();
            if (routedContexts.has(context)) return;
            await context.route('**/*', route => blockedResources.has(route.request().resourceType())
                ? route.abort()
                : route.continue());
            routedContexts.add(context);
        }],
    };
}

// Use process.cwd() to ensure paths are relative to the project root, not the file location
export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.resolve(ROOT_DIR, 'data');
export const RAW_DATA_DIR = path.join(DATA_DIR, 'raw-data');
export const DGP_DATA_DIR = path.join(RAW_DATA_DIR, 'dgp');
export const LATTES_DATA_DIR = path.join(RAW_DATA_DIR, 'lattes');
export const IMAGE_DIR = path.resolve(ROOT_DIR, '../api/static');
export const CRAWLER_STORAGE_ROOT_DIR = path.join(ROOT_DIR, 'storage');

export type CrawlerStorageName = 'dgp' | 'lattes' | 'discovery';

export const CRAWLER_STORAGE_DIRS: Record<CrawlerStorageName, string> = {
    dgp: path.join(CRAWLER_STORAGE_ROOT_DIR, 'dgp'),
    lattes: path.join(CRAWLER_STORAGE_ROOT_DIR, 'lattes'),
    discovery: path.join(CRAWLER_STORAGE_ROOT_DIR, 'discovery'),
};

[DATA_DIR, RAW_DATA_DIR, DGP_DATA_DIR, LATTES_DATA_DIR, IMAGE_DIR, CRAWLER_STORAGE_ROOT_DIR, ...Object.values(CRAWLER_STORAGE_DIRS)].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

export function saveJson(data: any, dir: string, fileName: string) {
    const filePath = path.join(dir, `${fileName}.json`);
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, json, 'utf-8');
    return Buffer.byteLength(json, 'utf-8');
}

export function createCrawlerConfig(storageName: CrawlerStorageName) {
    return new Configuration({
        purgeOnStart: false,
        storageClientOptions: {
            localDataDirectory: CRAWLER_STORAGE_DIRS[storageName],
        },
    });
}

export async function purgeCrawlerStorage(config: Configuration) {
    await purgeDefaultStorages(config);
}
