const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });

const { LattesQueueRepository } = require('../src/queue/lattes/lattesRepository');

test('nao publica lote BullMQ durante execucao Lattes tradicional', async () => {
    let created = false;
    const prisma = {
        pipelineLog: {
            findFirst: async query => {
                const cutoff = query.where.atualizadoEm.gte;
                assert.ok(cutoff instanceof Date);
                assert.ok(Date.now() - cutoff.getTime() <= 2 * 60 * 60 * 1000 + 1000);
                return { id: 'legacy-pipeline' };
            },
            create: async () => { created = true; },
        },
    };
    const repository = new LattesQueueRepository(prisma);

    await assert.rejects(repository.createBatch([
        { lattesId: '1234567890123456', nome: 'Pesquisador' },
    ]), /scraper Lattes tradicional esta em andamento/);
    assert.equal(created, false);
});
