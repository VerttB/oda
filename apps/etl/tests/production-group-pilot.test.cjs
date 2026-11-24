const assert = require('node:assert/strict');
const { test } = require('node:test');
const { evaluatePilotPair } = require('../dist/production-group/pilotRules');

const line = { id: 'line', titulo: 'Laboratório', objetivo: null, termos: ['Impressão 3D', 'Programação C++'] };
const group = { anoFormacao: 2014, areaPrincipalId: 'computacao', linhas: [line] };
const work = { titulo: 'Aplicações da impressão 3D', resumo: null, ano: 2021, palavras: [], areas: [] };

test('frase normalizada permite revisão, com registro da origem da evidência', () => {
    const result = evaluatePilotPair(work, group, [null, 2018]);
    assert.equal(result.triagem, 'REVISAR_AFINIDADE');
    assert.deepEqual(result.termosEmComum[0].termos, [{ termo: 'Impressão 3D', fontes: ['TITULO'] }]);
    assert.ok(result.flags.includes('HISTORICO_DE_VINCULO_INCOMPLETO'));
});

test('afinidade não remove os conflitos de data nem transforma ano inválido em conflito', () => {
    assert.equal(evaluatePilotPair({ ...work, ano: 2013 }, group, [null]).triagem, 'CONFLITO_TEMPORAL');
    assert.equal(evaluatePilotPair(work, group, [2022, 2023]).triagem, 'CONFLITO_TEMPORAL');
    assert.equal(evaluatePilotPair(work, group, [2022, null]).triagem, 'REVISAR_AFINIDADE');
    const malformed = evaluatePilotPair({ ...work, ano: 600 }, group, [2022]);
    assert.equal(malformed.triagem, 'REVISAR_AFINIDADE');
    assert.ok(malformed.flags.includes('SEM_ANO_DE_PUBLICACAO_VALIDO'));
});

test('C, C++ e C# continuam distintos na comparação de frases', () => {
    for (const titulo of ['Programação C moderna', 'Programação C# moderna']) {
        assert.equal(evaluatePilotPair({ ...work, titulo }, group, [2020]).triagem, 'EVIDENCIA_INSUFICIENTE');
    }
    assert.equal(evaluatePilotPair({ ...work, titulo: 'Programação C++ moderna' }, group, [2020]).triagem, 'REVISAR_AFINIDADE');
});

test('rótulo estrangeiro sem tradução revisada não inventa correspondência', () => {
    const foreign = { ...work, titulo: 'Teaching materials', palavras: [{ original: '3D printing' }] };
    assert.equal(evaluatePilotPair(foreign, group, [2020]).triagem, 'EVIDENCIA_INSUFICIENTE');
    foreign.palavras[0].rotuloRevisado = 'Impressão 3D';
    assert.deepEqual(evaluatePilotPair(foreign, group, [2020]).termosEmComum[0].termos, [
        { termo: 'Impressão 3D', fontes: ['PALAVRA_DA_PRODUCAO'] },
    ]);
});

test('área em comum fica como evidência auxiliar quando não há termos compatíveis', () => {
    const area = { id: 'computacao', nome: 'Computação' };
    const result = evaluatePilotPair({ ...work, titulo: 'Estruturas em grafos', areas: [area] }, group, [2020]);
    assert.equal(result.triagem, 'EVIDENCIA_INSUFICIENTE');
    assert.deepEqual(result.areaPrincipalEmComum, area);
});
