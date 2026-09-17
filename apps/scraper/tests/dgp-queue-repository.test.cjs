const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { DgpQueueRepository } = require('../src/queue/dgp/dgpRepository');

function database() {
    let state = { pipelines: {}, items: {}, groups: {} };
    let failCommit = false;
    const table = (name, key = 'id') => ({
        async create({ data }) {
            const row = { dataInicio: new Date(), ...structuredClone(data) };
            state[name][row[key]] = row;
            return structuredClone(row);
        },
        async findUnique({ where }) { return structuredClone(state[name][where[key]] || null); },
        async findUniqueOrThrow(query) {
            const row = await this.findUnique(query);
            if (!row) throw new Error('Registro ausente');
            return row;
        },
        async findMany({ where }) { return Object.values(state[name]).filter(row => row.pipelineLogId === where.pipelineLogId).map(row => structuredClone(row)); },
        async update({ where, data }) {
            const row = state[name][where[key]];
            for (const [field, value] of Object.entries(data)) {
                row[field] = value?.increment ? (row[field] || 0) + value.increment : structuredClone(value);
            }
            return structuredClone(row);
        },
    });
    const client = {
        pipelineLog: table('pipelines'), pipelineLogItem: table('items'), filaExtracaoGrupo: table('groups', 'dgpId'),
        async $queryRaw() {},
        async $transaction(callback) {
            const previous = structuredClone(state);
            try {
                const result = await callback(client);
                if (failCommit) throw new Error('Commit indisponivel');
                return result;
            } catch (error) { state = previous; throw error; }
        },
    };
    return { client, state: () => state, fail: () => { failCommit = true; } };
}

async function fixture(count = 1) {
    const db = database();
    const repository = new DgpQueueRepository(db.client);
    const ids = Array.from({ length: count }, (_, i) => String(i + 1).padStart(16, '0'));
    for (const dgpId of ids) await db.client.filaExtracaoGrupo.create({ data: { dgpId, status: 'PENDENTE', tentativas: 0 } });
    const batch = await repository.createBatch(ids);
    const data = batch.jobs[0];
    const result = { dgpId: data.dgpId, arquivoJson: `${data.dgpId}.json`, tamanhoTotalBytes: 120,
        membrosExtraidos: 2, linhasExtraidas: 1, instituicoesExtraidas: 1, pesquisadoresEnfileirados: 2 };
    return { db, repository, batch, data, result };
}

for (const { name, ids, expected } of [
    { name: 'vazio', ids: [], expected: null },
    { name: 'unitario', ids: ['1234567890123456'], expected: '1234567890123456' },
    { name: 'com varios grupos', ids: ['1234567890123456', '6543210987654321'], expected: null },
    { name: 'com IDs repetidos', ids: ['1234567890123456', '1234567890123456'], expected: '1234567890123456' },
]) {
    test(`criacao de lote ${name} define dgpId pela quantidade de grupos unicos`, async () => {
        const db = database();
        const repository = new DgpQueueRepository(db.client);
        const batch = await repository.createBatch(ids);
        const log = db.state().pipelines[batch.id];
        assert.equal(log.dgpId, expected);
        assert.deepEqual(log.metadata.jobs.map(job => job.dgpId), [...new Set(ids)]);
    });
}

test('publicacao com apenas um grupo aceito atualiza dgpId e preserva o lote ja selado', async () => {
    const s = await fixture(2);
    const accepted = s.batch.jobs[1];
    await s.repository.seal(s.batch, [accepted]);
    assert.equal(s.db.state().pipelines[s.batch.id].dgpId, accepted.dgpId);
    assert.equal(s.db.state().pipelines[s.batch.id].metadata.itensDuplicados, 1);

    await s.repository.seal(s.batch, s.batch.jobs);
    assert.equal(s.db.state().pipelines[s.batch.id].dgpId, accepted.dgpId);
    assert.deepEqual(s.db.state().pipelines[s.batch.id].metadata.jobs, [accepted]);

    await s.repository.begin(accepted);
    await s.repository.settle(accepted, { ...s.result, dgpId: accepted.dgpId });
    assert.equal(s.db.state().pipelines[s.batch.id].dgpId, accepted.dgpId);
    assert.equal(s.db.state().pipelines[s.batch.id].status, 'CONCLUIDO');
    assert.equal(s.db.state().items[accepted.pipelineItemId].entidadeId, accepted.dgpId);
});

test('lote SIMCC registra o escopo no manifesto e nos jobs', async () => {
    const db = database();
    const repository = new DgpQueueRepository(db.client);
    const batch = await repository.createBatch(['1234567890123456'], 'simcc');
    const log = db.state().pipelines[batch.id];
    assert.equal(log.metadata.scope, 'simcc');
    assert.equal(batch.jobs[0].scope, 'simcc');
});

test('publicacao sem grupos aceitos limpa dgpId do lote unitario', async () => {
    const s = await fixture();
    assert.equal(s.db.state().pipelines[s.batch.id].dgpId, s.data.dgpId);
    await s.repository.seal(s.batch, []);
    const log = s.db.state().pipelines[s.batch.id];
    assert.equal(log.dgpId, null);
    assert.equal(log.status, 'CONCLUIDO');
    assert.equal(log.metadata.itensDuplicados, 1);
    assert.equal(log.metadata.itensFila, 0);
    assert.equal(Object.keys(s.db.state().items).length, 0);
});

test('sucesso antes do fim da publicacao so encerra o lote depois de sela-lo', async () => {
    const s = await fixture();
    await s.repository.begin(s.data);
    await s.repository.settle(s.data, s.result);
    assert.equal(s.db.state().pipelines[s.batch.id].status, 'EMANDAMENTO');
    assert.equal(s.db.state().pipelines[s.batch.id].dgpId, s.data.dgpId);
    await s.repository.seal(s.batch, s.batch.jobs);
    const log = s.db.state().pipelines[s.batch.id];
    assert.equal(log.status, 'CONCLUIDO');
    assert.equal(log.dgpId, s.data.dgpId);
    assert.equal(log.quantidadeSucessos, 1);
    assert.equal(log.metadata.tamanhoTotalBytes, 120);
});

test('redelivery apos sucesso nao repete a coleta nem incrementa os totais', async () => {
    const s = await fixture();
    await s.repository.seal(s.batch, s.batch.jobs);
    await s.repository.begin(s.data);
    await s.repository.settle(s.data, s.result);
    assert.deepEqual(await s.repository.begin(s.data), s.result);
    await s.repository.settle(s.data, s.result);
    assert.equal(Object.keys(s.db.state().items).length, 1);
    assert.equal(s.db.state().groups[s.data.dgpId].tentativas, 1);
    assert.equal(s.db.state().pipelines[s.batch.id].metadata.tamanhoTotalBytes, 120);
});

test('falha de commit reverte fila, item e contadores juntos', async () => {
    const s = await fixture();
    await s.repository.seal(s.batch, s.batch.jobs);
    await s.repository.begin(s.data);
    s.db.fail();
    await assert.rejects(s.repository.settle(s.data, s.result), /Commit indisponivel/);
    assert.equal(s.db.state().groups[s.data.dgpId].status, 'PROCESSANDO');
    assert.equal(Object.keys(s.db.state().items).length, 0);
    assert.equal(s.db.state().pipelines[s.batch.id].quantidadeSucessos, 0);
});

test('duas tentativas preservam inicio; erro final encerra apenas seu grupo', async () => {
    const s = await fixture(2);
    await s.repository.seal(s.batch, s.batch.jobs);
    assert.equal(s.db.state().pipelines[s.batch.id].dgpId, null);
    await s.repository.begin(s.data);
    const start = s.db.state().groups[s.data.dgpId].processamentoIniciadoEm;
    await s.repository.begin(s.data);
    assert.deepEqual(s.db.state().groups[s.data.dgpId].processamentoIniciadoEm, start);
    assert.equal(s.db.state().groups[s.data.dgpId].tentativas, 2);
    await s.repository.settle(s.data, null, 'Processo caiu', 4);
    const state = s.db.state();
    assert.equal(state.groups[s.data.dgpId].status, 'ERRO');
    assert.equal(state.groups[s.data.dgpId].ultimoErroId, s.data.pipelineItemId);
    assert.equal(state.groups[s.batch.jobs[1].dgpId].status, 'PENDENTE');
    assert.equal(state.pipelines[s.batch.id].status, 'EMANDAMENTO');
    assert.equal(state.pipelines[s.batch.id].dgpId, null);
    assert.equal(state.items[s.data.pipelineItemId].entidadeId, s.data.dgpId);
    const second = s.batch.jobs[1];
    await s.repository.begin(second);
    await s.repository.settle(second, { ...s.result, dgpId: second.dgpId });
    assert.equal(s.db.state().pipelines[s.batch.id].status, 'ERRO');
    assert.equal(s.db.state().pipelines[s.batch.id].registrosProcessados, 2);
    assert.equal(s.db.state().pipelines[s.batch.id].dgpId, null);
    assert.equal(s.db.state().items[second.pipelineItemId].entidadeId, second.dgpId);
});
