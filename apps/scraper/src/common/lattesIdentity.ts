import type { CheerioAPI } from 'cheerio';

export function extractLattesId($: CheerioAPI): string {
    const ids = new Set<string>();
    const info = $('.informacoes-autor');
    info.find('li').each((_, element) => {
        const text = $(element).text().replace(/\s+/g, ' ').trim();
        const labeledId = text.match(/ID\s+Lattes\s*:\s*(\d{16})(?!\d)/i)?.[1];
        if (labeledId) ids.add(labeledId);
        for (const match of text.matchAll(/https?:\/\/lattes\.cnpq\.br\/(\d{16})(?!\d)/g)) ids.add(match[1]);
    });
    info.find('a[href]').each((_, element) => {
        const id = ($(element).attr('href') || '').match(/^https?:\/\/lattes\.cnpq\.br\/(\d{16})(?:[/?#]|$)/)?.[1];
        if (id) ids.add(id);
    });
    if (ids.size > 1) throw new Error('Curriculo com IDs Lattes conflitantes na identificacao.');
    const id = [...ids][0];
    if (!id) throw new Error('Curriculo sem ID Lattes valido; a pagina pode estar incompleta.');
    return id;
}
