const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseOpenAlexClassification, normalizeDoi } = require('../dist/lattes/openAlexClassification');
const { createOpenAlexLookup } = require('../dist/lattes/openAlexLookup');
const { linkProductionOpenAlex } = require('../dist/lattes/enrichment');
const { classificationResponseHash } = require('../dist/lattes/saveClassification');

test('hash da evidência independe da ordem de propriedades retornada pelo JSONB', () => {
    const a = { abstract: '', classification: { keywords: [{ id: 'k', score: 0.4 }], topics: [] } };
    const b = { classification: { topics: [], keywords: [{ score: 0.4, id: 'k' }] }, abstract: '' };
    assert.equal(classificationResponseHash(a), classificationResponseHash(b));
    assert.notEqual(classificationResponseHash(a), classificationResponseHash({ ...b, abstract: 'outro' }));
});

test('preserva scores baixos, zero e ausentes; deduplica por ID externo', () => {
    const result = parseOpenAlexClassification({ id: 'https://openalex.org/W123',
        keywords: [
            { id: 'https://openalex.org/keywords/cpp', display_name: 'C++', score: 0.4 },
            { id: 'https://openalex.org/keywords/cpp', display_name: 'C++', score: 0.2 },
            { id: 'https://openalex.org/keywords/csharp', display_name: 'C#', score: 0 },
            { id: 'https://openalex.org/keywords/databases', display_name: 'Databases' },
        ], primary_topic: { id: 'T2', display_name: 'Databases', score: 0.8 }, topics: [],
    });
    assert.deepEqual(result.keywords.map(k => k.score), [0.4, 0, null]);
    assert.equal(result.topics[0].id, 'https://openalex.org/T2');
    assert.equal(result.topics[0].principal, true);
});

test('consulta por DOI normalizado só uma vez por currículo, fora de transações', async () => {
    let calls = 0;
    const cached = { classification: { obraId: 'https://openalex.org/W1', keywords: [], topics: [] } };
    const db = { execucaoEnriquecimentoProducao: { async findFirst() { calls++; return { evidencia: cached }; } } };
    const lookup = createOpenAlexLookup(db);
    const [a, b] = await Promise.all([lookup('https://doi.org/10.123/ABC'), lookup('10.123/abc')]);
    assert.equal(calls, 1);
    assert.equal(a, b);
});

test('adaptador OpenAlex coleta classificação e rejeita DOI divergente', async () => {
    const originalFetch = global.fetch, key = process.env.OPEN_ALEX_KEY;
    const oldLog = console.log;
    try {
        process.env.OPEN_ALEX_KEY = 'chave-simulada';
        let calls = 0;
        global.fetch = async () => ({ ok: true, json: async () => ({
            id: 'https://openalex.org/W1', doi: calls++ ? 'https://doi.org/10.999/outro' : 'https://doi.org/10.123/abc',
            keywords: [{ id: 'https://openalex.org/keywords/database', display_name: 'Database', score: 0.4 }],
        }) });
        const result = await linkProductionOpenAlex('10.123/ABC');
        assert.equal(result.classification.keywords[0].score, 0.4);
        assert.ok(Number.isFinite(Date.parse(result.consultadaEm)));
        console.log = () => {};
        assert.equal(await linkProductionOpenAlex('10.123/abc'), undefined);
    } finally {
        global.fetch = originalFetch; console.log = oldLog;
        if (key === undefined) delete process.env.OPEN_ALEX_KEY; else process.env.OPEN_ALEX_KEY = key;
    }
});

test('listas vazias são válidas; IDs e scores inválidos não viram classificação', () => {
    assert.deepEqual(parseOpenAlexClassification({ id: 'W1' }).keywords, []);
    for (const score of [-1, 1.1, NaN, '0.4']) {
        assert.throws(() => parseOpenAlexClassification({ id: 'W1', keywords: [
            { id: 'https://openalex.org/keywords/x', display_name: 'X', score },
        ] }), /score inválido/);
    }
    assert.throws(() => parseOpenAlexClassification({ id: 'https://evil.invalid/W1' }), /ID works/);
    assert.equal(normalizeDoi(' https://doi.org/10.123/ABC '), '10.123/abc');
});

test('falhas do provedor não são tratadas como classificação vazia bem-sucedida', async () => {
    const originalFetch = global.fetch, key = process.env.OPEN_ALEX_KEY, oldLog = console.log;
    try {
        process.env.OPEN_ALEX_KEY = 'chave-simulada';
        console.log = () => {};
        const responses = [
            async () => ({ ok: false, status: 404 }),
            async () => ({ ok: false, status: 429 }),
            async () => { throw new Error('read ECONNRESET'); },
            async () => { throw new DOMException('Tempo esgotado', 'TimeoutError'); },
            async () => ({ ok: true, json: async () => ({ id: 'W1', keywords: 'schema alterado' }) }),
        ];
        for (const response of responses) {
            global.fetch = response;
            assert.equal(await linkProductionOpenAlex('10.123/abc'), undefined);
        }
        delete process.env.OPEN_ALEX_KEY;
        global.fetch = async () => { assert.fail('Não deve consultar sem chave configurada'); };
        assert.equal(await linkProductionOpenAlex('10.123/abc'), null);
    } finally {
        global.fetch = originalFetch; console.log = oldLog;
        if (key === undefined) delete process.env.OPEN_ALEX_KEY; else process.env.OPEN_ALEX_KEY = key;
    }
});
