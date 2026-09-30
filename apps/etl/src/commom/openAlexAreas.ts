import * as path from 'node:path';

export const OPENALEX_AREA_LEVELS = ['domains', 'fields', 'subfields', 'topics'] as const;
export type OpenAlexLevel = typeof OPENALEX_AREA_LEVELS[number];
export const OPENALEX_AREAS_DIR = path.resolve(__dirname, '..', '..', 'data', 'openalex-areas');
export const OPENALEX_AREAS_FILE = path.join(OPENALEX_AREAS_DIR, 'openalex-areas.json');
export const OPENALEX_TRANSLATIONS_DIR = path.resolve(__dirname, '..', '..', 'data', 'openalex-translations');
export const OPENALEX_TRANSLATED_CATALOG_FILE = path.join(OPENALEX_TRANSLATIONS_DIR, 'catalogo-traduzido.json');

export const OPENALEX_TYPE_BY_LEVEL = {
    domains: 'DOMAIN',
    fields: 'FIELD',
    subfields: 'SUBFIELD',
    topics: 'TOPIC',
} as const;

export type OpenAlexCatalogArea = {
    level: OpenAlexLevel;
    externalId: string;
    displayName: string;
    termo: string | null;
    nomesAlternativosTraduzidos: string[];
    parentExternalId: string | null;
    description: string | null;
    alternatives: string[];
    wikidataUrl: string | null;
    wikipediaUrl: string | null;
};

export function normalizeOpenAlexAreaId(value: string): string {
    return value.trim().replace(/^https?:\/\/openalex\.org\//i, '');
}

function requiredText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${field}: esperado texto nao vazio.`);
    }
    return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw new Error(`${field}: esperado texto ou null.`);
    return value.trim() || null;
}

function parseTranslatedTerm(value: unknown, original: string, field: string): string | null {
    if (value === undefined || value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${field}: esperado objeto de traducao.`);
    }
    const row = value as Record<string, unknown>;
    const translatedOriginal = optionalText(row.original, `${field}.original`);
    if (translatedOriginal && translatedOriginal !== original) {
        throw new Error(`${field}.original diverge do texto original.`);
    }
    return optionalText(row.termo, `${field}.termo`);
}

function parseLocalTerm(row: Record<string, unknown>, displayName: string, context: string): string | null {
    const translatedTerm = parseTranslatedTerm(row.traducao, displayName, `${context}.traducao`);
    if (translatedTerm) return translatedTerm;
    return optionalText(row.termo, `${context}.termo`);
}

function parseTranslatedAlternatives(value: unknown, alternatives: string[], field: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`${field}: esperado array.`);

    const known = new Set(alternatives);
    const translated = value.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error(`${field}.${index}: esperado objeto de traducao.`);
        }
        const row = item as Record<string, unknown>;
        const original = requiredText(row.original, `${field}.${index}.original`);
        if (!known.has(original)) {
            throw new Error(`${field}.${index}.original nao existe em alternatives.`);
        }
        return optionalText(row.termo, `${field}.${index}.termo`);
    });

    return [...new Set(translated.filter((item): item is string => Boolean(item)))];
}

function parseLocalAlternatives(row: Record<string, unknown>, alternatives: string[], context: string): string[] {
    const translatedAlternatives = parseTranslatedAlternatives(
        row.alternativasTraduzidas,
        alternatives,
        `${context}.alternativasTraduzidas`,
    );
    if (translatedAlternatives.length) return translatedAlternatives;

    const localAlternatives = row.nomesAlternativosTraduzidos ?? [];
    if (!Array.isArray(localAlternatives)) {
        throw new Error(`${context}.nomesAlternativosTraduzidos: esperado array.`);
    }
    return [...new Set(localAlternatives.map(item => requiredText(item, `${context}.nomesAlternativosTraduzidos`)))];
}

export function parseOpenAlexCatalog(input: unknown): OpenAlexCatalogArea[] {
    if (!Array.isArray(input) || input.length === 0) {
        throw new Error('O catalogo deve ser um array JSON nao vazio.');
    }

    const areas: OpenAlexCatalogArea[] = input.map((value, index) => {
        const context = `Registro ${index + 1}`;
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error(`${context}: esperado um objeto.`);
        }
        const row = value as Record<string, unknown>;
        const level = requiredText(row.level, `${context}.level`) as OpenAlexLevel;
        if (!OPENALEX_AREA_LEVELS.includes(level)) {
            throw new Error(`${context}: nivel desconhecido ${level}.`);
        }
        const externalId = normalizeOpenAlexAreaId(requiredText(row.externalId, `${context}.externalId`));
        const idPattern = level === 'topics' ? /^T\d+$/ : new RegExp(`^${level}/\\d+$`);
        if (!idPattern.test(externalId)) {
            throw new Error(`${context}: externalId ${externalId} incompativel com ${level}.`);
        }
        if (row.openAlexUrl != null && normalizeOpenAlexAreaId(requiredText(row.openAlexUrl, `${context}.openAlexUrl`)) !== externalId) {
            throw new Error(`${context}: openAlexUrl diverge de externalId.`);
        }
        const parent = optionalText(row.parentExternalId, `${context}.parentExternalId`);
        const alternatives = row.alternatives ?? [];
        if (!Array.isArray(alternatives)) throw new Error(`${context}.alternatives: esperado um array.`);
        const displayName = requiredText(row.displayName, `${context}.displayName`);
        const parsedAlternatives = [...new Set(alternatives.map(item => requiredText(item, `${context}.alternatives`)))];

        return {
            level,
            externalId,
            displayName,
            termo: parseLocalTerm(row, displayName, context),
            nomesAlternativosTraduzidos: parseLocalAlternatives(row, parsedAlternatives, context),
            parentExternalId: parent ? normalizeOpenAlexAreaId(parent) : null,
            description: optionalText(row.description, `${context}.description`),
            alternatives: parsedAlternatives,
            wikidataUrl: optionalText(row.wikidataUrl, `${context}.wikidataUrl`),
            wikipediaUrl: optionalText(row.wikipediaUrl, `${context}.wikipediaUrl`),
        };
    });

    const byId = new Map<string, OpenAlexCatalogArea>();
    for (const area of areas) {
        if (byId.has(area.externalId)) throw new Error(`externalId duplicado: ${area.externalId}.`);
        byId.set(area.externalId, area);
    }

    for (const area of areas) {
        const levelIndex = OPENALEX_AREA_LEVELS.indexOf(area.level);
        if (levelIndex === 0) {
            if (area.parentExternalId) throw new Error(`Domain ${area.externalId} nao pode ter pai.`);
            continue;
        }
        const parent = byId.get(area.parentExternalId);
        if (!parent || parent.level !== OPENALEX_AREA_LEVELS[levelIndex - 1]) {
            throw new Error(`Pai ausente ou de nivel incorreto para ${area.externalId}: ${area.parentExternalId}.`);
        }
    }

    return areas.sort((a, b) => OPENALEX_AREA_LEVELS.indexOf(a.level) - OPENALEX_AREA_LEVELS.indexOf(b.level)
        || a.externalId.localeCompare(b.externalId));
}
