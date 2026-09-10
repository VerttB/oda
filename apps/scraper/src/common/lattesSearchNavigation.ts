import type { Page } from 'playwright';

export async function submitLattesSearch(page: Page, submit: () => Promise<unknown>) {
    const [response] = await Promise.all([
        page.waitForResponse(candidate => {
            const request = candidate.request();
            return request.method() === 'POST'
                && candidate.url().includes('/buscatextual/busca.do');
        }, { timeout: 60000 }),
        submit(),
    ]);

    if (response.request().resourceType() === 'document') {
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    } else {
        // Permite que o callback da resposta atualize o DOM quando a busca usar AJAX.
        await page.waitForTimeout(250);
    }

    await page.locator('.resultado').first().waitFor({ state: 'attached', timeout: 30000 });
}
