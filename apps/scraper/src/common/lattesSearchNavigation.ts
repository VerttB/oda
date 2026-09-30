import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { log } from 'crawlee';
import type { Page, Request, Response } from 'playwright';
import { LATTES_DIAGNOSTICS_DIR } from './config';

export type LattesSearchDiagnosticContext = {
    lattesId?: string;
    nome?: string;
    tentativa?: number;
    paginaAtual?: number;
    timeoutMs?: number;
    diagnosticsDir?: string;
};

type NetworkEvent = {
    tipo: 'response' | 'request-failed';
    metodo: string;
    status?: number;
    resourceType: string;
    url: string;
    erro?: string | null;
};

const DIAGNOSTIC_SELECTORS = {
    resultado: '.resultado',
    itensResultado: 'ol li',
    campoBusca: '#textoBusca',
    botaoBusca: '#botaoBuscaFiltros',
    formulario: 'form',
    captcha: 'iframe[src*="recaptcha"], .g-recaptcha, [id*="captcha" i], [class*="captcha" i]',
    mensagemErro: '.erro, .error, .alert, .mensagem',
};

function sanitizeFileSegment(value: string) {
    return value.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'sem-identificador';
}

function isLattesNetworkEvent(url: string) {
    return url.includes('buscatextual.cnpq.br') || url.includes('lattes.cnpq.br');
}

function appendNetworkEvent(events: NetworkEvent[], event: NetworkEvent) {
    events.push(event);
    if (events.length > 30) events.shift();
}

async function safePageValue<T>(read: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await read();
    } catch {
        return fallback;
    }
}

export async function captureLattesSearchFailure(
    page: Page,
    context: LattesSearchDiagnosticContext,
    error: unknown,
    networkEvents: NetworkEvent[] = [],
) {
    const diagnosticsDir = context.diagnosticsDir ?? LATTES_DIAGNOSTICS_DIR;
    const capturedAt = new Date();
    const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-');
    const identifier = sanitizeFileSegment(context.lattesId || context.nome || 'busca');
    const attempt = context.tentativa ?? 1;
    const baseName = `${timestamp}-${identifier}-tentativa-${attempt}`;
    const htmlPath = path.join(diagnosticsDir, `${baseName}.html`);
    const metadataPath = path.join(diagnosticsDir, `${baseName}.json`);

    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => undefined);

    const [title, html, bodyText, selectorEntries] = await Promise.all([
        safePageValue(() => page.title(), ''),
        safePageValue(() => page.content(), '<!-- Nao foi possivel capturar o HTML porque a pagina estava navegando. -->'),
        safePageValue(() => page.locator('body').innerText(), ''),
        Promise.all(Object.entries(DIAGNOSTIC_SELECTORS).map(async ([name, selector]) => [
            name,
            await safePageValue(() => page.locator(selector).count(), -1),
        ] as const)),
    ]);

    const metadata = {
        capturadoEm: capturedAt.toISOString(),
        lattesId: context.lattesId ?? null,
        nome: context.nome ?? null,
        tentativa: attempt,
        paginaAtual: context.paginaAtual ?? null,
        erro: error instanceof Error ? error.message : String(error),
        url: page.url(),
        titulo: title,
        seletores: Object.fromEntries(selectorEntries),
        textoInicial: bodyText.replace(/\s+/g, ' ').trim().slice(0, 1000),
        eventosRede: networkEvents,
        arquivoHtml: htmlPath,
    };

    try {
        await fs.mkdir(diagnosticsDir, { recursive: true });
        await Promise.all([
            fs.writeFile(htmlPath, html, 'utf8'),
            fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8'),
        ]);
        log.warning('[Lattes] Diagnostico da falha de busca salvo.', {
            lattesId: metadata.lattesId,
            tentativa: metadata.tentativa,
            url: metadata.url,
            titulo: metadata.titulo,
            seletores: metadata.seletores,
            arquivoHtml: htmlPath,
            arquivoMetadata: metadataPath,
        });
    } catch (captureError) {
        log.warning('[Lattes] Nao foi possivel salvar o diagnostico da falha de busca.', {
            lattesId: metadata.lattesId,
            tentativa: metadata.tentativa,
            erro: captureError instanceof Error ? captureError.message : String(captureError),
        });
    }
}

export async function submitLattesSearch(
    page: Page,
    submit: () => Promise<unknown>,
    context: LattesSearchDiagnosticContext = {},
) {
    const networkEvents: NetworkEvent[] = [];
    const onResponse = (response: Response) => {
        if (!isLattesNetworkEvent(response.url())) return;
        appendNetworkEvent(networkEvents, {
            tipo: 'response',
            metodo: response.request().method(),
            status: response.status(),
            resourceType: response.request().resourceType(),
            url: response.url(),
        });
    };
    const onRequestFailed = (request: Request) => {
        if (!isLattesNetworkEvent(request.url())) return;
        appendNetworkEvent(networkEvents, {
            tipo: 'request-failed',
            metodo: request.method(),
            resourceType: request.resourceType(),
            url: request.url(),
            erro: request.failure()?.errorText ?? null,
        });
    };

    page.on('response', onResponse);
    page.on('requestfailed', onRequestFailed);
    try {
        await submit();
        await page.locator('.resultado').first().waitFor({
            state: 'attached',
            timeout: context.timeoutMs ?? 40000,
        });
    } catch (error) {
        await captureLattesSearchFailure(page, context, error, networkEvents);
        throw error;
    } finally {
        page.off('response', onResponse);
        page.off('requestfailed', onRequestFailed);
    }
}
