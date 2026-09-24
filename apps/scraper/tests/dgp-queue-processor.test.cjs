const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
function replace(name, exports) {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
}
let state;
replace('../src/queue/dgp/dgpRepository', { DgpQueueRepository: class {
    async begin() { state.begun++; return state.cached; }
    async settle(_data, result) {
        if (state.dbFailure) throw new Error('Banco indisponivel');
        state.result = result;
    }
} });
replace('../src/common/database', { prisma: {} });
replace('../src/common/config', { SCRAPER_SETTINGS: { dgp: { loginRetryDelayMs: 60000 } } });
replace('../src/common/utils', { sleep: async ms => { state.delays.push(ms); } });
replace('../src/queue/dgp/dgpSingleGroup', { collectDgpJob: async (_dgpId, reportProgress, scope) => {
    state.collections++;
    state.scope = scope;
    if (state.failure) throw state.failure === true ? new Error('DGP indisponivel') : state.failure;
    await reportProgress({ etapa: 'SALVANDO_JSON', percentual: 90, itensProcessados: null, itensTotal: null });
    return { dgpId: '1234567890123456', arquivoJson: '1234567890123456.json' };
} });
const processor = require('../src/queue/dgp/dgpProcessor').default;
const { DGP_QUEUE_SETTINGS, JOB_NAMES } = require('@oda/queue');
const job = () => ({ name: JOB_NAMES.SCRAPE_DGP_GROUP,
    data: { version: 1, dgpId: '1234567890123456', requestedAt: new Date().toISOString(),
        pipelineLogId: randomUUID(), pipelineItemId: randomUUID() },
    async updateProgress(progress) { state.progress.push(progress); }, log() {},
});
beforeEach(() => { state = { begun: 0, collections: 0, progress: [], delays: [] }; });

test('processor nao confirma sucesso se a gravacao no banco falhar', async () => {
    state.dbFailure = true;
    await assert.rejects(processor(job()), /Banco indisponivel/);
    assert.equal(state.collections, 1);
    assert.deepEqual(state.delays, [DGP_QUEUE_SETTINGS.interGroupDelayMs]);
    assert.deepEqual(state.progress.map(p => p.etapa), ['INICIANDO', 'SALVANDO_JSON']);
});
test('excecao da coleta e propagada ao BullMQ', async () => {
    state.failure = true;
    await assert.rejects(processor(job()), /DGP indisponivel/);
    assert.equal(state.result, undefined);
    assert.deepEqual(state.delays, [DGP_QUEUE_SETTINGS.interGroupDelayMs]);
});
test('login no popup aguarda antes de devolver o job para retry', async () => {
    const { DgpLoginRedirectError } = require('../src/common/dgpPageContent');
    state.failure = new DgpLoginRedirectError();
    await assert.rejects(processor(job()), /login/);
    assert.deepEqual(state.delays, [60000]);
    assert.equal(state.result, undefined);
});
test('job ja gravado retorna seu resultado sem abrir outro crawler', async () => {
    state.cached = { dgpId: '1234567890123456', arquivoJson: '1234567890123456.json' };
    assert.deepEqual(await processor(job()), state.cached);
    assert.equal(state.collections, 0);
    assert.deepEqual(state.delays, []);
});
test('processor publica progresso completo somente depois de persistir o resultado', async () => {
    await processor(job());
    assert.deepEqual(state.progress.map(p => p.etapa), ['INICIANDO', 'SALVANDO_JSON', 'CONCLUIDO']);
    assert.deepEqual(state.progress.map(p => p.percentual), [0, 90, 100]);
    assert.ok(state.progress.every(p => !Number.isNaN(Date.parse(p.progressoEm))));
    assert.deepEqual(state.delays, [DGP_QUEUE_SETTINGS.interGroupDelayMs]);
});
test('processor repassa o escopo SIMCC para a coleta', async () => {
    const input = job();
    input.data.scope = 'simcc';
    await processor(input);
    assert.equal(state.scope, 'simcc');
});
test('job antigo de demonstracao e recusado antes de acessar o banco', async () => {
    const input = job();
    delete input.data.pipelineLogId;
    await assert.rejects(processor(input), { name: 'UnrecoverableError' });
    assert.equal(state.begun, 0);
});
