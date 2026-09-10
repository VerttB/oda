import { Page } from 'playwright';
import { DGP_TIMEOUTS } from './config';

export class DgpLoginRedirectError extends Error {
    readonly code = 'DGP_LOGIN_REDIRECT';

    constructor() {
        super('DGP redirecionou a pagina de detalhes para login.');
        this.name = 'DgpLoginRedirectError';
    }
}

export function isDgpLoginRedirectError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: unknown; message?: unknown };
    return candidate.code === 'DGP_LOGIN_REDIRECT'
        || (typeof candidate.message === 'string' && /DGP redirecionou.+login/i.test(candidate.message));
}

// Validate and serialize the same document, avoiding a navigation between checks and content().
export async function readDgpPageContent(page: Page, selector: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await page.waitForLoadState('domcontentloaded', { timeout: DGP_TIMEOUTS.detailMs });
            if (isLogin(page.url())) throw new DgpLoginRedirectError();
            await page.locator(selector).first().waitFor({ state: 'attached', timeout: DGP_TIMEOUTS.detailMs });
            return await page.evaluate((expectedSelector) => {
                if (location.hostname === 'login.cnpq.br' || location.pathname.includes('/faces/login.jsf')) {
                    throw new Error('DGP redirecionou a pagina para login.');
                }
                if (!document.querySelector(expectedSelector)) {
                    throw new Error('Documento DGP mudou durante a leitura.');
                }
                return document.documentElement.outerHTML;
            }, selector);
        } catch (error) {
            if (isLogin(page.url())) throw new DgpLoginRedirectError();
            const message = error instanceof Error ? error.message : String(error);
            const transient = /Execution context was destroyed|navigating|Documento DGP mudou/i.test(message);
            if (page.isClosed() || isLogin(page.url()) || !transient || attempt === 2) throw error;
        }
    }
    throw new Error('Nao foi possivel ler a pagina DGP.');
}

function isLogin(url: string) {
    return url.includes('login.cnpq.br/') || url.includes('/faces/login.jsf');
}
