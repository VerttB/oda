const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');

require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });

const state = { workers: [], reconciliations: 0 };
const replace = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};

class FakeWorker extends EventEmitter {
    constructor() {
        super();
        this.closeCalls = 0;
        state.workers.push(this);
    }

    async run() {
        const finished = new Promise(resolve => { this.finish = resolve; });
        if (state.workers.length === 1) {
            for (let index = 0; index < 3; index++) {
                this.emit('completed', { id: `job-${index}`, data: { lattesId: String(index) } });
            }
        } else {
            process.emit('SIGINT');
        }
        await finished;
    }

    async close() {
        this.closeCalls++;
        this.finish?.();
    }
}

replace('@oda/queue', {
    Worker: FakeWorker,
    QUEUE_NAMES: { LATTES_SCRAPER: 'lattes-test' },
    LATTES_QUEUE_SETTINGS: { concurrency: 1, maxJobsPerProcess: 3, reconcileIntervalMs: 30000 },
    createQueueConnection: () => ({}),
});
replace('../src/queue/lattes/lattesDispatch', {
    reconcileLattesQueue: async () => { state.reconciliations++; },
});
replace('../src/queue/lattes/lattesRepository', { LattesQueueRepository: class {} });

const { runLattesWorker } = require('../src/queue/lattes/lattesWorker');

test('recicla o subprocesso apos o limite e encerra sem abandonar job', async () => {
    const queue = { setGlobalConcurrency: async value => { assert.equal(value, 1); } };
    await runLattesWorker(queue, {});

    assert.equal(state.workers.length, 2);
    assert.ok(state.workers.every(worker => worker.closeCalls > 0));
    assert.ok(state.reconciliations >= 2);
});
