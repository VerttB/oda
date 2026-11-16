const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reconcileEtlQueues } = require('../dist/queue/etlDispatch');

test('reconcilia fila grande consultando resultados em lotes e sem alterar jobs pendentes', async () => {
    const jobs = Array.from({ length: 13147 }, (_, index) => ({
        lattesId: String(index).padStart(16, '0'), pipelineItemId: `item-${index}`,
    }));
    let queries = 0;
    const batch = { id: 'lote', groupJobs: [], researcherJobs: jobs, groupsPublished: true, researchersPublished: true };
    const repository = {
        async *openBatches() { yield batch; },
        async getOpenBatch() { return batch; },
        async completedItems(items) { queries++; assert.ok(items.length <= 500); return new Set(); },
        async settle() { throw new Error('Job pendente não deve ser finalizado'); },
    };
    let reads = 0;
    const researcherQueue = { async getJob(id) {
        const index = Number(id.slice(-16));
        reads++;
        return { data: jobs[index], async getState() { return 'waiting'; } };
    } };
    await reconcileEtlQueues({}, researcherQueue, repository);
    assert.equal(queries, Math.ceil(jobs.length / 500));
    assert.equal(reads, jobs.length);
});

test('reconciliações no mesmo processo não se sobrepõem', async () => {
    let active = 0, max = 0, passes = 0;
    const repository = { async *openBatches() {
        active++; max = Math.max(max, active); passes++;
        await new Promise(resolve => setTimeout(resolve, 10));
        active--;
    } };
    await Promise.all([reconcileEtlQueues({}, {}, repository), reconcileEtlQueues({}, {}, repository)]);
    assert.equal(max, 1);
    assert.equal(passes, 2);
});
