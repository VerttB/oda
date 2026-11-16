const { test } = require('node:test');
const assert = require('node:assert/strict');
const queueModule = require.resolve('@oda/queue');
const queues = require(queueModule);
const created = [];

class FakeWorker {
    constructor(name) { this.name = name; created.push(name); }
    on() {}
    async run() {}
    async close() {}
}

require.cache[queueModule].exports = { ...queues, Worker: FakeWorker };
const { runEtlWorkers } = require('../dist/queue/etlWorker');
require.cache[queueModule].exports = queues;

for (const scope of ['default', 'simcc']) {
    test(`worker ETL ${scope} inicia apenas os consumidores do seu escopo`, async () => {
        created.length = 0;
        let researcherConcurrencyChanges = 0;
        const group = { name: queues.scopedQueueName(queues.QUEUE_NAMES.ETL_GROUPS, scope), async setGlobalConcurrency() {} };
        const dispatch = { name: queues.scopedQueueName(queues.QUEUE_NAMES.ETL_DISPATCH, scope), async setGlobalConcurrency() {} };
        const researcher = { async setGlobalConcurrency() { researcherConcurrencyChanges++; } };
        const repository = { scope, async *openBatches() {} };
        await runEtlWorkers(group, researcher, dispatch, repository);
        assert.deepEqual(created, [group.name, ...(scope === 'default' ? [queues.QUEUE_NAMES.ETL_RESEARCHERS] : []), dispatch.name]);
        assert.equal(researcherConcurrencyChanges, scope === 'default' ? 1 : 0);
    });
}

test('consumidores iniciam antes de concluir uma reconciliação lenta', async () => {
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    let entered;
    const started = new Promise(resolve => { entered = resolve; });
    const originalRun = FakeWorker.prototype.run;
    FakeWorker.prototype.run = async function () { entered(); };
    const queue = name => ({ name, async setGlobalConcurrency() {} });
    let first = true;
    const repository = { scope: 'simcc', async *openBatches() {
        if (first) { first = false; await blocked; }
    } };
    try {
        const execution = runEtlWorkers(queue('groups'), queue('researchers'), queue('dispatch'), repository);
        await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('worker bloqueado')), 1000))]);
        release();
        await execution;
    } finally {
        release();
        FakeWorker.prototype.run = originalRun;
    }
});
