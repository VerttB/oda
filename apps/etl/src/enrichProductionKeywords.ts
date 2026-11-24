import { PrismaClient, prismaConfig } from '@oda/database';
import { parseArgs } from 'node:util';
import { CLASSIFICATION_VERSION } from './lattes/openAlexClassification';
import { linkProductionOpenAlex } from './lattes/enrichment';
import { saveClassification } from './lattes/saveClassification';

async function main() {
    const { values } = parseArgs({ options: {
        apply: { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        limit: { type: 'string', default: '50' },
        after: { type: 'string' },
        refresh: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
    } });
    if (values.help) {
        console.log('pnpm enrich:keywords [--limit 50] [--after UUID] [--apply] [--refresh]');
        console.log('Padrão: somente leitura, sem chamadas OpenAlex. --apply grava; --refresh reconsulta enriquecidos.');
        return;
    }
    if (values.apply && values['dry-run']) throw new Error('Use --apply ou --dry-run.');
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit deve estar entre 1 e 500.');
    const destination = new URL(process.env.DATABASE_URL || '');
    console.log('[Palavras-chave] Destino:', { host: destination.hostname, porta: destination.port || '5432', banco: destination.pathname.slice(1) });
    if (values.apply && !process.env.OPEN_ALEX_KEY) throw new Error('OPEN_ALEX_KEY não configurada.');
    const db = new PrismaClient(prismaConfig);
    try {
        const rows = await db.producao.findMany({ where: {
            doi: { not: null }, ...(values.after ? { id: { gt: values.after } } : {}),
            ...(!values.refresh ? { execucoesEnriquecimento: { none: { versaoMetodo: CLASSIFICATION_VERSION } } } : {}),
        }, select: { id: true, doi: true }, orderBy: { id: 'asc' }, take: limit });
        console.log('[Palavras-chave] Selecionadas:', rows.length, 'Último ID:', rows[rows.length - 1]?.id ?? null);
        if (!values.apply) {
            console.log('[Palavras-chave] Simulação: sem requisições OpenAlex ou gravações. Use --apply após conferir destino e backup.');
            return;
        }
        let saved = 0, withoutData = 0;
        for (const row of rows) {
            // Todas as requisições acontecem antes da transação.
            const data = await linkProductionOpenAlex(row.doi!);
            if (!data) { withoutData++; continue; }
            await db.$transaction(tx => saveClassification(tx, row.id, row.doi!, data), { timeout: 30000 });
            saved++;
        }
        console.log('[Palavras-chave] Resultado:', { selecionadas: rows.length, enriquecidas: saved, semDadosOuFalha: withoutData });
    } finally { await db.$disconnect(); }
}

main().catch(error => { console.error('[Palavras-chave]', error instanceof Error ? error.message : 'Falha no enriquecimento'); process.exitCode = 1; });
