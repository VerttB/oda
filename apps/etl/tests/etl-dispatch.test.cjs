const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('despacho le arquivos no host ETL e cria um unico lote', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oda-etl-dispatch-'));
    process.env.SCRAPER_DATA_DIR = root;
    const dgpDir = path.join(root, 'raw-data', 'dgp');
    const lattesDir = path.join(root, 'raw-data', 'lattes');
    fs.mkdirSync(dgpDir, { recursive: true });
    fs.mkdirSync(lattesDir, { recursive: true });
    fs.writeFileSync(path.join(dgpDir, '1234567890123456.json'), '{}');
    fs.writeFileSync(path.join(lattesDir, '6543210987654321.json'), '{}');

    const { prepareEtlBatch } = require('../dist/queue/etlBatch');
    const queue = { getJob: async () => null };
    const progress = [];
    const repository = {
        async *openBatches() {},
        getBatch: async () => null,
        createBatch: async (groups, researchers, id) => {
            assert.equal(groups.length, 1);
            assert.equal(researchers.length, 1);
            return { id, groupJobs: groups, researcherJobs: researchers };
        },
    };
    const result = await prepareEtlBatch({
        version: 1, requestId: '11111111-1111-4111-8111-111111111111',
        requestedAt: new Date().toISOString(), tipo: 'TODOS', ids: [], scope: 'default',
    }, queue, queue, repository, async (etapa, percentual) => progress.push({ etapa, percentual }));

    assert.deepEqual(result, {
        requestId: '11111111-1111-4111-8111-111111111111',
        pipelineLogId: '11111111-1111-4111-8111-111111111111', grupos: 1, pesquisadores: 1,
    });
    assert.deepEqual(progress.map(item => item.etapa), ['LENDO_ARQUIVOS', 'CRIANDO_LOTE', 'PUBLICANDO']);
    fs.rmSync(root, { recursive: true, force: true });
});
