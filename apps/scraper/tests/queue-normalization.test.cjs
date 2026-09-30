const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });

test('normaliza uma unica leitura e corrige similares mesmo quando o primeiro item ja esta correto', async () => {
    let reads = 0;
    const updates = [];
    const similarUpdates = [];
    const items = [
        { dgpId: '1', nome: 'Grupo', area: 'Area', instituicao: 'Universidade', similares: 2 },
        { dgpId: '2', nome: ' Grupo  ', area: 'Area', instituicao: 'Universidade', similares: 1 },
        { dgpId: '3', nome: 'Outro', area: 'Area', instituicao: 'Universidade', similares: 1 },
    ];
    const client = { filaExtracaoGrupo: {
        async findMany() { reads++; return items; },
        async update(query) { updates.push(query); },
        async updateMany(query) { similarUpdates.push(query); },
    } };
    const modulePath = require.resolve('@oda/database');
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: {
        PrismaClient: class { constructor() { return client; } },
        FilaExtracaoStatus: {},
    } };
    const { db } = require('../src/common/database');
    await db.normalizeQueueData();
    assert.equal(reads, 1);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.nome, 'Grupo');
    assert.deepEqual(similarUpdates, [{ where: { dgpId: { in: ['2'] } }, data: { similares: 2 } }]);
});
