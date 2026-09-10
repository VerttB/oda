import type { Locator, Page } from 'playwright';
import { DGP_TIMEOUTS } from './config';

export const DGP_DETAIL_SELECTORS = {
    rh: "#recursosHumanos a[id*='idBtnVisualizarEspelho']:not([id*='LinhaPesquisa'])",
    institutions: "tbody[id$='j_idt388_data'] a[id$=':visualizar']",
    lines: "a[id*='idBtnVisualizarEspelhoLinhaPesquisa']",
};

export type DgpDetailButton = {
    id: string;
    selector: string;
    index: number;
    nome: string;
};


function normalizeText(text: string | null | undefined) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

async function getRowName(button: Locator) {
    return normalizeText(await button.evaluate(element =>
        (element.closest('tr')?.querySelector('td')?.textContent || '').trim()));
}

export async function readDgpDetailButtons(page: Page, selector: string) {
    // Guardamos apenas dados serializados. O ID completo do JSF e instavel, entao
    // ele e usado so como primeira tentativa, nunca como fonte unica.
    return page.locator(selector).evaluateAll((elements, stableSelector) => elements.map((element, index) => ({
        id: element.id,
        selector: stableSelector,
        index,
        nome: (element.closest('tr')?.querySelector('td')?.textContent || '').trim(),
    })), selector);
}

async function findButtonByRowName(page: Page, item: DgpDetailButton) {
    const expectedName = normalizeText(item.nome);
    if (!expectedName) return null;

    const buttons = page.locator(item.selector);
    const matchingIndex = await buttons.evaluateAll((elements, expected) => {
        const normalize = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim();
        return elements.findIndex(element =>
            normalize(element.closest('tr')?.querySelector('td')?.textContent) === expected);
    }, expectedName);

    return matchingIndex >= 0 ? buttons.nth(matchingIndex) : null;
}

async function ensureExpectedButton(button: Locator, item: DgpDetailButton) {
    await button.waitFor({ state: 'attached', timeout: DGP_TIMEOUTS.detailMs });
    await button.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
    await button.waitFor({ state: 'visible', timeout: DGP_TIMEOUTS.detailMs });

    const expectedName = normalizeText(item.nome);
    const currentName = await getRowName(button);

    if (expectedName && currentName && currentName !== expectedName) {
        throw new Error(`Botao DGP divergente: esperado "${expectedName}", encontrado "${currentName}".`);
    }

    return button;
}

export async function resolveDgpDetailButton(page: Page, item: DgpDetailButton) {
    const attempts: Array<{ label: string; button: Locator | null }> = [];

    if (item.id) {
        const exactButton = page.locator(`a[id=${JSON.stringify(item.id)}]`).first();
        if (await exactButton.count() > 0) {
            attempts.push({ label: `id=${item.id}`, button: exactButton });
        }
    }

    const buttons = page.locator(item.selector);
    if (item.index < await buttons.count()) {
        attempts.push({ label: `index=${item.index}`, button: buttons.nth(item.index) });
    }

    attempts.push({ label: `nome=${item.nome || 'N/A'}`, button: await findButtonByRowName(page, item) });

    let lastError: unknown = null;
    for (const attempt of attempts) {
        if (!attempt.button) continue;

        try {
            return await ensureExpectedButton(attempt.button, item);
        } catch (error) {
            lastError = error;
        }
    }

    const currentCount = await page.locator(item.selector).count();
    const detail = lastError instanceof Error ? ` Ultimo erro: ${lastError.message}` : '';
    throw new Error(`Nao foi possivel resolver botao DGP "${item.nome || item.id}" com seletor "${item.selector}" no indice ${item.index}. Botoes atuais: ${currentCount}.${detail}`);
}
