import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { normalizeString } from './commom/normalize';
import {
    OPENALEX_AREAS_DIR,
    OPENALEX_AREAS_FILE,
    OPENALEX_AREA_LEVELS,
    OPENALEX_TRANSLATED_CATALOG_FILE,
    normalizeOpenAlexAreaId,
} from './commom/openAlexAreas';
import { importOpenAlexAreas } from './importOpenAlexAreas';

const OPENALEX_BASE_URL = 'https://api.openalex.org';
const OPENALEX_API_KEY = process.env.OPEN_ALEX_KEY;
const PAGE_SIZE = 200;
const OUTPUT_DIR = OPENALEX_AREAS_DIR;

type OpenAlexLevel = 'domains' | 'fields' | 'subfields' | 'topics';
type AreaLevel = 'GRANDE_AREA' | 'AREA' | 'SUBAREA' | 'TOPICO';

type OpenAlexParent = {
    id: string;
    display_name: string;
};

type OpenAlexArea = {
    id: string;
    ids?: Record<string, string | null>;
    display_name: string;
    display_name_alternatives?: string[];
    description?: string | null;
    domain?: OpenAlexParent | null;
    field?: OpenAlexParent | null;
    subfield?: OpenAlexParent | null;
};

type OpenAlexListResponse<T> = {
    results: T[];
    meta?: {
        next_cursor?: string | null;
    };
};

type ExportedArea = {
    level: OpenAlexLevel;
    tipo: AreaLevel;
    externalId: string;
    openAlexUrl: string;
    displayName: string;
    nomeNormalizado: string;
    parentExternalId: string | null;
    parentDisplayName: string | null;
    wikidataUrl: string | null;
    wikipediaUrl: string | null;
    description: string | null;
    alternatives: string[];
};

const tipoByLevel: Record<OpenAlexLevel, AreaLevel> = {
    domains: 'GRANDE_AREA',
    fields: 'AREA',
    subfields: 'SUBAREA',
    topics: 'TOPICO',
};

function getParent(level: OpenAlexLevel, item: OpenAlexArea): OpenAlexParent | null {
    if (level === 'fields') return item.domain ?? null;
    if (level === 'subfields') return item.field ?? null;
    if (level === 'topics') return item.subfield ?? null;
    return null;
}

function toExportedArea(level: OpenAlexLevel, item: OpenAlexArea): ExportedArea {
    const parent = getParent(level, item);

    return {
        level,
        tipo: tipoByLevel[level],
        externalId: normalizeOpenAlexAreaId(item.id),
        openAlexUrl: item.ids?.openalex ?? item.id,
        displayName: item.display_name,
        nomeNormalizado: normalizeString(item.display_name),
        parentExternalId: parent ? normalizeOpenAlexAreaId(parent.id) : null,
        parentDisplayName: parent?.display_name ?? null,
        wikidataUrl: item.ids?.wikidata ?? null,
        wikipediaUrl: item.ids?.wikipedia ?? null,
        description: item.description ?? null,
        alternatives: item.display_name_alternatives ?? [],
    };
}

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = Array.isArray(value) ? value.join('|') : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: ExportedArea[]): string {
    const headers: (keyof ExportedArea)[] = [
        'level',
        'tipo',
        'externalId',
        'openAlexUrl',
        'displayName',
        'nomeNormalizado',
        'parentExternalId',
        'parentDisplayName',
        'wikidataUrl',
        'wikipediaUrl',
        'description',
        'alternatives',
    ];

    return [
        headers.join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header])).join(',')),
    ].join('\n');
}

async function fetchOpenAlexPage<T>(level: OpenAlexLevel, cursor: string): Promise<OpenAlexListResponse<T>> {
    if (!OPENALEX_API_KEY) {
        throw new Error('OPEN_ALEX_KEY não configurada no ambiente.');
    }

    const url = new URL(`${OPENALEX_BASE_URL}/${level}`);
    url.searchParams.set('per-page', String(PAGE_SIZE));
    url.searchParams.set('cursor', cursor);
    url.searchParams.set('api_key', OPENALEX_API_KEY);

    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`OpenAlex ${level} falhou: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<OpenAlexListResponse<T>>;
}

async function fetchAllOpenAlexAreas(level: OpenAlexLevel): Promise<ExportedArea[]> {
    const areas: ExportedArea[] = [];
    let cursor = '*';

    do {
        const data = await fetchOpenAlexPage<OpenAlexArea>(level, cursor);
        areas.push(...data.results.map(item => toExportedArea(level, item)));
        cursor = data.meta?.next_cursor || '';
        console.log(`[OpenAlex] ${level}: ${areas.length} registros carregados...`);
    } while (cursor);

    return areas;
}

async function main() {
    const { values } = parseArgs({ options: {
        import: { type: 'boolean', default: false },
        file: { type: 'string' },
        translated: { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
    } });
    if (values.help) {
        console.log('Exportar da API: pnpm openalex:areas (OPEN_ALEX_KEY no ambiente)');
        console.log('Importar JSON local: pnpm openalex:areas:import [--file caminho.json] [--translated] [--dry-run]');
        console.log('Caminhos relativos a --file usam a raiz do projeto quando executados pelo pnpm.');
        return;
    }
    if (values.import) {
        if (values.file && values.translated) {
            throw new Error('Use --file ou --translated, nao os dois.');
        }
        const filePath = values.translated
            ? OPENALEX_TRANSLATED_CATALOG_FILE
            : values.file
                ? path.resolve(process.env.INIT_CWD || process.cwd(), values.file)
                : OPENALEX_AREAS_FILE;
        await importOpenAlexAreas(filePath, values['dry-run']);
        return;
    }
    if (values.file || values.translated || values['dry-run']) throw new Error('--file, --translated e --dry-run exigem --import.');
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const levels = OPENALEX_AREA_LEVELS;
    const allAreas: ExportedArea[] = [];

    for (const level of levels) {
        const levelAreas = await fetchAllOpenAlexAreas(level);
        allAreas.push(...levelAreas);

        fs.writeFileSync(
            path.join(OUTPUT_DIR, `${level}.json`),
            JSON.stringify(levelAreas, null, 2),
            'utf-8',
        );
    }

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'openalex-areas.json'),
        JSON.stringify(allAreas, null, 2),
        'utf-8',
    );

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'openalex-areas.csv'),
        toCsv(allAreas),
        'utf-8',
    );

    console.log(`[OpenAlex] Exportados ${allAreas.length} registros em ${OUTPUT_DIR}`);
}

main().catch(error => {
    console.error('[OpenAlex] Erro ao processar areas:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
