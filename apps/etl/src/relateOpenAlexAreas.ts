import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { PrismaClient, prismaConfig, MetodoMapeamentoAreaTaxonomia, StatusMapeamentoAreaTaxonomia } from '@oda/database';
import { normalizeString } from './commom/normalize';
import { normalizeOpenAlexAreaId, OPENALEX_AREAS_DIR } from './commom/openAlexAreas';

type CnpqArea = { id: string; nome: string; nomeNormalizado: string; areaPaiId: string | null };
type OpenAlexArea = {
    id: string;
    externalId: string;
    termo: string;
    termoEstrangeiro: string | null;
    nomesAlternativos: string[];
    areaPaiId: string | null;
};
type AreaMapping = { openAlexAreaId: string; areaConhecimentoId: string };
type AreaAlias = { externalId: string; termos: string[] };

export type AreaMappingSuggestion = AreaMapping & {
    externalId: string;
    termoOpenAlex: string;
    nomeCnpq: string;
    areaPaiOpenAlexId: string | null;
    areaPaiCnpqId: string | null;
    termoComparado: string;
    metodo: typeof MetodoMapeamentoAreaTaxonomia.TEXTO_NORMALIZADO;
    status: typeof StatusMapeamentoAreaTaxonomia.PENDENTE;
    tipoRelacao: null;
    observacao: string;
};

export function parseAreaAliases(input: unknown): AreaAlias[] {
    if (!Array.isArray(input)) throw new Error('Aliases devem ser um array JSON de { externalId, termos }.');
    return input.map((value, index) => {
        if (!value || typeof value !== 'object' || typeof value.externalId !== 'string'
            || !value.externalId.trim() || !Array.isArray(value.termos) || !value.termos.length
            || value.termos.some((term: unknown) => typeof term !== 'string' || !normalizeString(term))) {
            throw new Error(`Alias ${index + 1} invalido: informe externalId e termos nao vazios.`);
        }
        return {
            externalId: normalizeOpenAlexAreaId(value.externalId),
            termos: [...new Set<string>(value.termos.map((term: string) => term.trim()))],
        };
    });
}

export function suggestAreaMappings(
    cnpqAreas: CnpqArea[],
    openAlexAreas: OpenAlexArea[],
    existing: AreaMapping[],
    aliases: AreaAlias[] = [],
): AreaMappingSuggestion[] {
    const openAlexIds = new Set(openAlexAreas.map(area => area.externalId));
    const aliasesById = new Map<string, string[]>();
    for (const alias of aliases) {
        if (!openAlexIds.has(alias.externalId)) throw new Error(`Alias aponta para area OpenAlex nao importada: ${alias.externalId}.`);
        aliasesById.set(alias.externalId, [...(aliasesById.get(alias.externalId) ?? []), ...alias.termos]);
    }

    const cnpqByName = new Map<string, CnpqArea[]>();
    for (const area of cnpqAreas) {
        const normalized = normalizeString(area.nome);
        if (!normalized) continue;
        const matches = cnpqByName.get(normalized) ?? [];
        matches.push(area);
        cnpqByName.set(normalized, matches);
    }
    const knownPairs = new Set(existing.map(mapping => JSON.stringify([mapping.openAlexAreaId, mapping.areaConhecimentoId])));
    const suggestions: AreaMappingSuggestion[] = [];
    for (const area of openAlexAreas) {
        const terms = [area.termo, area.termoEstrangeiro, ...area.nomesAlternativos, ...(aliasesById.get(area.externalId) ?? [])];
        for (const term of terms) {
            const normalized = normalizeString(term);
            if (!normalized) continue;
            for (const cnpq of cnpqByName.get(normalized) ?? []) {
                const pair = JSON.stringify([area.id, cnpq.id]);
                if (knownPairs.has(pair)) continue;
                knownPairs.add(pair);
                suggestions.push({
                    openAlexAreaId: area.id,
                    areaConhecimentoId: cnpq.id,
                    externalId: area.externalId,
                    termoOpenAlex: area.termo,
                    nomeCnpq: cnpq.nome,
                    areaPaiOpenAlexId: area.areaPaiId,
                    areaPaiCnpqId: cnpq.areaPaiId,
                    termoComparado: term,
                    metodo: MetodoMapeamentoAreaTaxonomia.TEXTO_NORMALIZADO,
                    status: StatusMapeamentoAreaTaxonomia.PENDENTE,
                    tipoRelacao: null,
                    observacao: `Nome normalizado coincidente: "${term}" / "${cnpq.nome}" (${normalized}). Revisar significado e hierarquia antes de aprovar.`,
                });
            }
        }
    }
    return suggestions.sort((a, b) => a.externalId.localeCompare(b.externalId)
        || a.areaConhecimentoId.localeCompare(b.areaConhecimentoId));
}

export async function persistAreaMappingSuggestions(prisma: PrismaClient, suggestions: AreaMappingSuggestion[]): Promise<number> {
    let inserted = 0;
    for (let offset = 0; offset < suggestions.length; offset += 20) {
        const result = await prisma.mapeamentoAreaTaxonomia.createMany({
            data: suggestions.slice(offset, offset + 20).map(item => ({
                openAlexAreaId: item.openAlexAreaId,
                areaConhecimentoId: item.areaConhecimentoId,
                metodo: MetodoMapeamentoAreaTaxonomia.TEXTO_NORMALIZADO,
                status: StatusMapeamentoAreaTaxonomia.PENDENTE,
                observacao: item.observacao,
            })),
            // Decisoes existentes, inclusive rejeicoes, nunca sao substituidas por sugestoes.
            skipDuplicates: true,
        });
        inserted += result.count;
    }
    return inserted;
}

async function main(): Promise<void> {
    const { values } = parseArgs({ options: {
        'dry-run': { type: 'boolean', default: false },
        aliases: { type: 'string' },
        output: { type: 'string' },
        help: { type: 'boolean', default: false },
    } });
    if (values.help) {
        console.log('pnpm openalex:areas:relacionar [--dry-run] [--aliases arquivo.json] [--output relatorio.json]');
        console.log('Compara nomes normalizados, incluindo traducoes locais e aliases informados. Nao traduz automaticamente.');
        console.log('--dry-run consulta o banco e gera JSON, sem gravar correspondencias.');
        console.log('Aliases: [{ "externalId": "fields/17", "termos": ["Ciencia da Computacao"] }]');
        return;
    }
    const baseDir = process.env.INIT_CWD || process.cwd();
    const aliases = values.aliases
        ? parseAreaAliases(JSON.parse((await fs.readFile(path.resolve(baseDir, values.aliases), 'utf8')).replace(/^\uFEFF/, '')))
        : [];
    const outputPath = values.output ? path.resolve(baseDir, values.output) : path.join(OPENALEX_AREAS_DIR, 'mapeamentos-pendentes.json');
    const prisma = new PrismaClient(prismaConfig);
    try {
        const cnpqAreas = await prisma.areaConhecimento.findMany({
            select: { id: true, nome: true, nomeNormalizado: true, areaPaiId: true },
        });
        const openAlexAreas = await prisma.openAlexAreaConhecimento.findMany({
            select: { id: true, externalId: true, termo: true, termoEstrangeiro: true, nomesAlternativos: true, areaPaiId: true },
        });
        if (!cnpqAreas.length || !openAlexAreas.length) throw new Error('As duas tabelas de areas precisam estar populadas antes de relacionar.');
        const existing = await prisma.mapeamentoAreaTaxonomia.findMany({
            select: { openAlexAreaId: true, areaConhecimentoId: true },
        });
        const suggestions = suggestAreaMappings(cnpqAreas, openAlexAreas, existing, aliases);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify({
            geradoEm: new Date().toISOString(),
            simulacao: values['dry-run'],
            totalAreasCnpq: cnpqAreas.length,
            totalAreasOpenAlex: openAlexAreas.length,
            totalMapeamentosExistentes: existing.length,
            totalSugestoes: suggestions.length,
            sugestoes: suggestions,
        }, null, 2), 'utf8');
        console.log(`[OpenAlex] ${suggestions.length} novas sugestoes. Relatorio: ${outputPath}`);
        if (values['dry-run']) {
            console.log('[OpenAlex] Simulacao concluida, sem gravacoes no banco.');
            return;
        }
        const inserted = await persistAreaMappingSuggestions(prisma, suggestions);
        console.log(`[OpenAlex] ${inserted} correspondencias PENDENTES inseridas; mapeamentos existentes preservados.`);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('[OpenAlex] Erro ao relacionar areas:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
