const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { publishBatch, reconcileDgpQueue } = require('../src/queue/dgp/dgpDispatch');
const { dgpJobId } = require('@oda/queue');

function fixture() {
    const id = randomUUID();
    const data = { version: 1, dgpId: '1234567890123456', requestedAt: new Date().toISOString(),
        pipelineLogId: id, pipelineItemId: randomUUID() };
    const batch = { id, jobs: [data], published: false };
    const state = { batch, data, stored: new Map(), items: new Map(), additions: 0, settlements: [], sealed: [] };
    state.queue = {
        async add(_name, jobData, opts) {
            state.additions++;
            if (!state.stored.has(opts.jobId)) state.stored.set(opts.jobId, { data: jobData, getState: async () => 'waiting' });
            return { data: jobData };
        },
        async getJob(id) { return state.stored.get(id); },
    };
    state.repository = {
        async result(job) { return state.items.get(job.pipelineItemId); },
        async seal(_batch, jobs) { state.sealed.push(jobs); batch.jobs = jobs; batch.published = true; },
        async *openBatches() { yield batch; },
        async settle(...args) { state.settlements.push(args); },
    };
    return state;
}

test('publicacao duplicada usa o dono real do job, nao o objeto retornado por add', async () => {
    const s = fixture();
    s.stored.set(dgpJobId(s.data.dgpId), { data: { ...s.data, pipelineItemId: randomUUID() } });
    assert.equal(await publishBatch(s.batch, s.queue, s.repository), 0);
    assert.deepEqual(s.sealed, [[]]);
});

test('publicacao interrompida reutiliza job aceito e nao republica resultado SQL concluido', async () => {
    const s = fixture();
    await s.queue.add('test', s.data, { jobId: dgpJobId(s.data.dgpId) });
    assert.equal(await publishBatch(s.batch, s.queue, s.repository), 1);
    assert.equal(s.stored.size, 1);
    s.items.set(s.data.pipelineItemId, { status: 'SUCESSO' });
    s.stored.clear();
    const before = s.additions;
    await publishBatch(s.batch, s.queue, s.repository);
    assert.equal(s.additions, before);
});

test('falha de Redis nao sela o manifesto; retomada termina a publicacao', async () => {
    const s = fixture();
    const add = s.queue.add;
    s.queue.add = async () => { throw new Error('Redis indisponivel'); };
    await assert.rejects(publishBatch(s.batch, s.queue, s.repository), /Redis indisponivel/);
    assert.equal(s.batch.published, false);
    s.queue.add = add;
    await reconcileDgpQueue(s.queue, s.repository);
    assert.equal(s.batch.published, true);
});

test('backoff e job ativo nao sao encerrados como erro; falha final e conciliada', async () => {
    const s = fixture();
    s.batch.published = true;
    let status = 'delayed';
    s.stored.set(dgpJobId(s.data.dgpId), { data: s.data, getState: async () => status,
        failedReason: 'Processo caiu', attemptsMade: 4 });
    await reconcileDgpQueue(s.queue, s.repository);
    status = 'active';
    await reconcileDgpQueue(s.queue, s.repository);
    assert.equal(s.settlements.length, 0);
    status = 'failed';
    await reconcileDgpQueue(s.queue, s.repository);
    assert.deepEqual(s.settlements[0], [s.data, null, 'Processo caiu', 4]);
});

test('perda de job no Redis republica apenas trabalho sem resultado SQL', async () => {
    const s = fixture();
    s.batch.published = true;
    await reconcileDgpQueue(s.queue, s.repository);
    assert.equal(s.additions, 1);
    s.stored.clear();
    s.items.set(s.data.pipelineItemId, { status: 'SUCESSO' });
    await reconcileDgpQueue(s.queue, s.repository);
    assert.equal(s.additions, 1);
});

test('completed no Redis sem gravacao SQL nao produz falso sucesso', async () => {
    const s = fixture();
    s.batch.published = true;
    s.stored.set(dgpJobId(s.data.dgpId), { data: s.data, getState: async () => 'completed' });
    await reconcileDgpQueue(s.queue, s.repository);
    assert.equal(s.settlements[0][1], null);
    assert.match(s.settlements[0][2], /sem comprovacao/);
});
