const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });

const { discoveryJobId } = require('@oda/queue');
const { parseDiscoveryTerritoryArguments } = require('../src/queue/discovery/discoveryTerritory');

test('descoberta mantem Bahia como padrao', () => {
    const parsed = parseDiscoveryTerritoryArguments([]);

    assert.deepEqual(parsed.ufs, ['BA']);
    assert.equal(parsed.chaves.length, 5);
    assert.equal(parsed.targets.length, 5);
});

test('descoberta expande Nordeste e Brasil em jobs da mesma fila', () => {
    const northeast = parseDiscoveryTerritoryArguments(['--regiao', 'nordeste']);
    const brazil = parseDiscoveryTerritoryArguments(['--brasil']);

    assert.deepEqual(northeast.ufs, ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE']);
    assert.equal(northeast.targets.length, 45);
    assert.equal(brazil.ufs.length, 27);
    assert.equal(brazil.targets.length, 135);
});

test('UF participa do identificador e opcoes territoriais nao podem ser combinadas', () => {
    assert.notEqual(discoveryJobId('a', 'BA'), discoveryJobId('a', 'PE'));
    assert.throws(
        () => parseDiscoveryTerritoryArguments(['--regiao', 'nordeste', '--estados', 'BA']),
        /apenas uma abrangencia/,
    );
});
