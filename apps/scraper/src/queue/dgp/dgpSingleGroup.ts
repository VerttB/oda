import { PlaywrightCrawler } from 'crawlee';
import { randomUUID } from 'node:crypto';
import { createCrawlerConfig, createCrawlerOptions } from '../../common/config';
import type { DataScope } from '@oda/queue';
import { scrapeGroupPage } from '../../scrapers/dgpScraper';
import type { DgpProgressReporter } from '../../scrapers/dgpScraper';

export async function collectDgpJob(
    dgpId: string,
    reportProgress: DgpProgressReporter = async () => {},
    scope: DataScope = 'default',
) {
    const config = createCrawlerConfig('dgp', `bull-${randomUUID()}`);
    config.set('persistStorage', false);
    let result: Awaited<ReturnType<typeof scrapeGroupPage>> | undefined;
    let failure: Error | undefined;
    const crawler = new PlaywrightCrawler({
        ...createCrawlerOptions('dgp'),
        maxRequestRetries: 0,
        maxSessionRotations: 0,
        async requestHandler({ page }) {
            await reportProgress({
                etapa: 'ABRINDO_ESPELHO', percentual: 5,
                itensProcessados: null, itensTotal: null,
            });
            result = await scrapeGroupPage(page, dgpId, undefined, reportProgress, scope);
        },
        async failedRequestHandler(_context, error) { failure = error; },
    }, config);
    try {
        await crawler.run([{ url: `http://dgp.cnpq.br/dgp/espelhogrupo/${dgpId}` }]);
        if (failure) throw failure;
        if (!result) throw new Error('Crawler DGP terminou sem resultado.');
        return { dgpId, ...result };
    } finally {
        await crawler.browserPool.destroy();
    }
}
