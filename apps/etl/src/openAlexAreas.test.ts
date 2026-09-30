import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { PrismaClient } from '@oda/database';
import { parseOpenAlexCatalog } from './commom/openAlexAreas';
import { persistOpenAlexCatalog } from './importOpenAlexAreas';
import { parseAreaAliases, persistAreaMappingSuggestions, suggestAreaMappings } from './relateOpenAlexAreas';

function catalog() {
    return [
        { level: 'topics', externalId: 'T1', displayName: 'Algorithms', parentExternalId: 'subfields/1701' },
        { level: 'domains', externalId: 'domains/3', displayName: 'Physical Sciences', parentExternalId: null },
        { level: 'subfields', externalId: 'subfields/1701', displayName: 'Artificial Intelligence', parentExternalId: 'fields/17' },
        { level: 'fields', externalId: 'fields/17', displayName: 'Computer Science', parentExternalId: 'domains/3' },
    ];
}

test('catalogo legado e ordenado pela hierarquia e aceita IDs completos', () => {
    const input = catalog().map(area => ({ ...area, tipo: 'valor legado ignorado' }));
    input[1].externalId = 'https://openalex.org/domains/3';
    const areas = parseOpenAlexCatalog(input);
    assert.deepEqual(areas.map(area => area.externalId), ['domains/3', 'fields/17', 'subfields/1701', 'T1']);
    assert.deepEqual(areas[0].alternatives, []);
});

test('catalogo rejeita duplicatas, pais ausentes, nivel errado e identificadores divergentes', () => {
    assert.throws(() => parseOpenAlexCatalog([...catalog(), catalog()[0]]), /duplicado/);
    assert.throws(() => parseOpenAlexCatalog(catalog().slice(1).filter(area => area.level !== 'domains')), /Pai ausente/);
    assert.throws(() => parseOpenAlexCatalog(catalog().map(area => area.level === 'topics'
        ? { ...area, parentExternalId: 'domains/3' } : area)), /nivel incorreto/);
    assert.throws(() => parseOpenAlexCatalog(catalog().map(area => ({ ...area, openAlexUrl: 'https://openalex.org/T999' }))), /diverge/);
    assert.throws(() => parseOpenAlexCatalog(catalog().map(area => area.level === 'domains'
        ? { ...area, externalId: '3' } : area)), /incompativel/);
});

test('catalogo invalido e rejeitado antes de qualquer acesso ao banco', async () => {
    await assert.rejects(persistOpenAlexCatalog({} as PrismaClient, [catalog()[0]]), /Pai ausente/);
});

function catalogDatabase() {
    const rows = new Map<string, any>();
    const batches: number[] = [];
    const delegate = {
        findMany: async () => [...rows.values()],
        upsert: async ({ where, create, update }: any) => {
            const previous = rows.get(where.externalId);
            const next = previous ? { ...previous, ...update } : { id: `local-${rows.size + 1}`, ...create };
            if (next.areaPaiId) assert.ok([...rows.values()].some(row => row.id === next.areaPaiId), 'Pai precisa existir antes do filho');
            rows.set(where.externalId, next);
            batches[batches.length - 1]++;
            return { id: next.id, externalId: next.externalId };
        },
    };
    const prisma = {
        openAlexAreaConhecimento: delegate,
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
            batches.push(0);
            return callback({ openAlexAreaConhecimento: delegate });
        },
    } as unknown as PrismaClient;
    return { rows, batches, prisma };
}

test('reimportacao preserva IDs, traducoes e registros externos ao arquivo, atualizando metadados', async () => {
    const { rows, prisma } = catalogDatabase();
    assert.deepEqual(await persistOpenAlexCatalog(prisma, catalog()), {
        total: 4,
        criadas: 4,
        atualizadas: 0,
    });
    const field = rows.get('fields/17');
    field.termo = 'Ciencia da Computacao';
    field.termoNormalizado = 'ciencia-computacao';
    rows.set('domains/9', { id: 'preservado', externalId: 'domains/9' });
    const refreshed = catalog().map(area => ({ ...area, description: 'Descricao atualizada', alternatives: ['Alternative'] }));
    assert.deepEqual(await persistOpenAlexCatalog(prisma, refreshed), {
        total: 4,
        criadas: 0,
        atualizadas: 4,
    });
    assert.equal(rows.size, 5);
    assert.equal(rows.get('fields/17').id, field.id);
    assert.equal(rows.get('fields/17').termo, 'Ciencia da Computacao');
    assert.equal(rows.get('fields/17').termoNormalizado, 'ciencia-computacao');
    assert.equal(rows.get('fields/17').termoEstrangeiro, 'Computer Science');
    assert.equal(rows.get('fields/17').descricao, 'Descricao atualizada');
    assert.equal(rows.get('fields/17').tipo, 'FIELD');
    assert.deepEqual(rows.get('fields/17').nomesAlternativos, ['Alternative']);
});

test('catalogo traduzido atualiza termo local e preserva termo estrangeiro', async () => {
    const { rows, prisma } = catalogDatabase();
    const translated = catalog().map(area => area.externalId === 'fields/17' ? {
        ...area,
        alternatives: ['Computing'],
        traducao: {
            original: 'Computer Science',
            traducaoAutomatica: 'Ci\u00eancia da Computa\u00e7\u00e3o',
            termo: 'Ci\u00eancia da Computa\u00e7\u00e3o',
            termoNormalizado: 'ciencia da computacao',
            revisado: false,
        },
        alternativasTraduzidas: [{
            original: 'Computing',
            traducaoAutomatica: 'Computa\u00e7\u00e3o',
            termo: 'Computa\u00e7\u00e3o',
            termoNormalizado: 'computacao',
            revisado: false,
        }],
    } : area);

    assert.deepEqual(await persistOpenAlexCatalog(prisma, translated), {
        total: 4,
        criadas: 4,
        atualizadas: 0,
    });

    assert.equal(rows.get('fields/17').termo, 'Ci\u00eancia da Computa\u00e7\u00e3o');
    assert.equal(rows.get('fields/17').termoNormalizado, 'ciencia-computacao');
    assert.equal(rows.get('fields/17').termoEstrangeiro, 'Computer Science');
    assert.deepEqual(rows.get('fields/17').nomesAlternativos, ['Computa\u00e7\u00e3o']);
});

test('catalogo traduzido preserva traducao quando ja foi parseado antes do import', () => {
    const translated = catalog().map(area => area.externalId === 'fields/17' ? {
        ...area,
        alternatives: ['Computing'],
        traducao: {
            original: 'Computer Science',
            traducaoAutomatica: 'Ci\u00eancia da Computa\u00e7\u00e3o',
            termo: 'Ci\u00eancia da Computa\u00e7\u00e3o',
            termoNormalizado: 'ciencia da computacao',
            revisado: false,
        },
        alternativasTraduzidas: [{
            original: 'Computing',
            traducaoAutomatica: 'Computa\u00e7\u00e3o',
            termo: 'Computa\u00e7\u00e3o',
            termoNormalizado: 'computacao',
            revisado: false,
        }],
    } : area);

    const twiceParsed = parseOpenAlexCatalog(parseOpenAlexCatalog(translated));
    const field = twiceParsed.find(area => area.externalId === 'fields/17');

    assert.equal(field?.termo, 'Ci\u00eancia da Computa\u00e7\u00e3o');
    assert.deepEqual(field?.nomesAlternativosTraduzidos, ['Computa\u00e7\u00e3o']);
});

test('importacao limita cada transacao a 20 areas do mesmo nivel', async () => {
    const { prisma, batches } = catalogDatabase();
    const input = [catalog()[1], ...Array.from({ length: 25 }, (_, index) => ({
        level: 'fields', externalId: `fields/${index + 1}`, displayName: `Field ${index + 1}`, parentExternalId: 'domains/3',
    }))];
    assert.deepEqual(await persistOpenAlexCatalog(prisma, input), {
        total: 26,
        criadas: 26,
        atualizadas: 0,
    });
    assert.deepEqual(batches, [1, 20, 5]);
});

const cnpq = [
    { id: 'cnpq-1', nome: 'Ci\u00eancia da Computa\u00e7\u00e3o', nomeNormalizado: 'ciencia-computacao', areaPaiId: 'cnpq-pai' },
];
const openAlex = [
    { id: 'oa-1', externalId: 'fields/17', termo: 'Computer Science', termoEstrangeiro: 'Computer Science', nomesAlternativos: [], areaPaiId: 'oa-pai' },
];

test('nomes em ingles nao sao traduzidos implicitamente; alias gera sugestao pendente sem equivalencia presumida', () => {
    assert.deepEqual(suggestAreaMappings(cnpq, openAlex, []), []);
    const aliases = parseAreaAliases([{ externalId: 'https://openalex.org/fields/17', termos: ['Ciencia da Computacao'] }]);
    const suggestions = suggestAreaMappings(cnpq, openAlex, [], aliases);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].status, 'PENDENTE');
    assert.equal(suggestions[0].tipoRelacao, null);
    assert.equal(suggestions[0].metodo, 'TEXTO_NORMALIZADO');
    assert.equal(suggestions[0].areaPaiCnpqId, 'cnpq-pai');
});

test('traducoes e nomes alternativos repetidos geram um par; nomes apenas parecidos nao sao vinculados', () => {
    const translated = [{ ...openAlex[0], termo: 'Ciencia da Computacao', nomesAlternativos: ['ciencia de computacao'] }];
    const areas = [...cnpq, { ...cnpq[0], id: 'cnpq-2', nome: 'Engenharia da Computacao' }];
    assert.equal(suggestAreaMappings(areas, translated, []).length, 1);
    assert.deepEqual(suggestAreaMappings(areas, translated, [{ openAlexAreaId: 'oa-1', areaConhecimentoId: 'cnpq-1' }]), []);
});

test('aliases desconhecidos ou vazios sao rejeitados', () => {
    assert.throws(() => parseAreaAliases([{ externalId: 'fields/17', termos: [''] }]), /invalido/);
    assert.throws(() => suggestAreaMappings(cnpq, openAlex, [], [{ externalId: 'fields/99', termos: ['Ciencia da Computacao'] }]), /nao importada/);
});

test('persistencia nao altera mapeamentos existentes, inclusive quando inseridos depois da consulta', async () => {
    const translated = [{ ...openAlex[0], termo: 'Ciencia da Computacao' }];
    const suggestions = suggestAreaMappings(cnpq, translated, []);
    const rows = new Map<string, any>([['oa-1/cnpq-1', { status: 'REJEITADO', observacao: 'Revisado manualmente' }]]);
    const prisma = { mapeamentoAreaTaxonomia: {
        createMany: async ({ data, skipDuplicates }: any) => {
            assert.equal(skipDuplicates, true);
            let count = 0;
            for (const item of data) {
                const key = `${item.openAlexAreaId}/${item.areaConhecimentoId}`;
                if (!rows.has(key)) { rows.set(key, item); count++; }
            }
            return { count };
        },
    } } as unknown as PrismaClient;
    assert.equal(await persistAreaMappingSuggestions(prisma, suggestions), 0);
    assert.equal(rows.get('oa-1/cnpq-1').status, 'REJEITADO');
    assert.equal(rows.get('oa-1/cnpq-1').observacao, 'Revisado manualmente');
    rows.clear();
    assert.equal(await persistAreaMappingSuggestions(prisma, suggestions), 1);
    assert.equal(await persistAreaMappingSuggestions(prisma, suggestions), 0);
    assert.equal(rows.get('oa-1/cnpq-1').status, 'PENDENTE');
});
