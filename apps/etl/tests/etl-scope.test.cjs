const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EtlQueueRepository } = require('../dist/queue/etlRepository');

test('reconciliacao e consulta de lotes ETL respeitam o servidor dono dos arquivos', async () => {
    const rows = [undefined, 'default', 'simcc'].map((scope, index) => ({
        id: String(index), status: 'EMANDAMENTO', metadata: {
            queue: 'oda-etl-pipeline', scope, groupJobs: [], researcherJobs: [],
            groupsPublished: true, researchersPublished: true,
        },
    }));
    const prisma = { pipelineLog: {
        findMany: async ({ cursor }) => cursor ? [] : rows,
        findUnique: async ({ where }) => rows.find(row => row.id === where.id),
    } };
    for (const [scope, expected] of [['default', ['0', '1']], ['simcc', ['2']]]) {
        const repository = new EtlQueueRepository(prisma, scope);
        const ids = [];
        for await (const batch of repository.openBatches()) ids.push(batch.id);
        assert.deepEqual(ids, expected);
        await assert.rejects(repository.getBatch(scope === 'simcc' ? '0' : '2'), /outro escopo/);
    }
});

test('SIMCC nao aceita pesquisadores ou arquivos do escopo geral', async () => {
    const repository = new EtlQueueRepository({}, 'simcc');
    await assert.rejects(repository.createBatch([{ scope: 'default' }], []), /outro escopo/);
    await assert.rejects(repository.createBatch([], [{ scope: 'default' }]), /outro escopo/);
});
