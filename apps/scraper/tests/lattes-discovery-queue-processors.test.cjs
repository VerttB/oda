const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });

function replace(name, exports) {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
}

let lattesState;
class TestLattesError extends Error {
    constructor(message, tipoErro) { super(message); this.tipoErro = tipoErro; }
}
replace('../src/queue/lattes/lattesRepository', { LattesQueueRepository: class {
    async begin() { lattesState.begun++; return lattesState.cached; }
    async settle(...args) {
        if (lattesState.dbFailure) throw new Error('Banco indisponivel');
        lattesState.settlements.push(args);
    }
} });
replace('../src/common/database', { prisma: {} });
replace('../src/scrapers/lattesScraper', {
    LattesCollectionError: TestLattesError,
    collectLattesResearcher: async (_target, reportProgress) => {
        lattesState.collections++;
        if (lattesState.failure) throw lattesState.failure;
        await reportProgress({ etapa: 'SALVANDO_JSON', percentual: 85, paginaAtual: 1, paginasTotal: 1 });
        return { lattesId: '1234567890123456', arquivoJson: '1234567890123456.json', tamanhoTotalBytes: 10, producoesExtraidas: 2, imagemBaixada: true };
    },
});
const lattesProcessor = require('../src/queue/lattes/lattesProcessor').default;

let discoveryState;
replace('../src/queue/discovery/discoveryRepository', { DiscoveryQueueRepository: class {
    async begin() { discoveryState.begun++; return discoveryState.cached; }
    async settle(_data, result) {
        if (discoveryState.dbFailure) throw new Error('Banco indisponivel');
        discoveryState.result = result;
    }
} });
replace('../src/scrapers/dgpDiscovery', {
    runDgpDiscovery: async (_keys, options) => {
        discoveryState.collections++;
        if (discoveryState.failure) throw new Error('DGP indisponivel');
        await options.reportProgress({ etapa: 'PROCESSANDO_PAGINAS', percentual: null, paginasProcessadas: 1, itensDescobertos: 5, itensPulados: 0, itensComErro: 0 });
        return { chave: 'computacao', paginasProcessadas: 1, itensDescobertos: 5, itensPulados: 0, itensComErro: 0, tamanhoCacheInicial: 0, tamanhoCacheFinal: 5 };
    },
});
const discoveryProcessor = require('../src/queue/discovery/discoveryProcessor').default;
const { JOB_NAMES } = require('@oda/queue');
const { TipoErroColeta } = require('@oda/database');

function lattesJob() {
    return {
        name: JOB_NAMES.SCRAPE_LATTES_RESEARCHER,
        data: { version: 1, lattesId: '1234567890123456', nome: 'Pesquisador', requestedAt: new Date().toISOString(), pipelineLogId: randomUUID(), pipelineItemId: randomUUID() },
        attemptsMade: 0, async updateProgress(progress) { lattesState.progress.push(progress); }, log() {},
    };
}

function discoveryJob() {
    return {
        name: JOB_NAMES.DISCOVER_DGP_GROUPS,
        data: { version: 1, chave: 'computacao', requestedAt: new Date().toISOString(), pipelineLogId: randomUUID(), pipelineItemId: randomUUID() },
        async updateProgress(progress) { discoveryState.progress.push(progress); }, log() {},
    };
}

beforeEach(() => {
    lattesState = { begun: 0, collections: 0, progress: [], settlements: [] };
    discoveryState = { begun: 0, collections: 0, progress: [] };
});

test('Lattes confirma SQL antes da conclusao e reaproveita resultado persistido', async () => {
    await lattesProcessor(lattesJob());
    assert.equal(lattesState.settlements.length, 1);
    assert.deepEqual(lattesState.progress.map(item => item.etapa), ['SALVANDO_JSON', 'CONCLUIDO']);
    lattesState.cached = { lattesId: '1234567890123456', arquivoJson: 'existente.json' };
    assert.deepEqual(await lattesProcessor(lattesJob()), lattesState.cached);
    assert.equal(lattesState.collections, 1);
});

test('Lattes grava NAO_ENCONTRADO e impede retentativa BullMQ', async () => {
    lattesState.failure = new TestLattesError('Nao encontrado', TipoErroColeta.NAO_ENCONTRADO);
    await assert.rejects(lattesProcessor(lattesJob()), { name: 'UnrecoverableError' });
    assert.equal(lattesState.settlements.length, 1);
    assert.equal(lattesState.settlements[0][4], TipoErroColeta.NAO_ENCONTRADO);
});

test('Discovery repassa contadores e nao confirma sucesso se o commit falhar', async () => {
    discoveryState.dbFailure = true;
    await assert.rejects(discoveryProcessor(discoveryJob()), /Banco indisponivel/);
    assert.equal(discoveryState.collections, 1);
    assert.deepEqual(discoveryState.progress[0], {
        etapa: 'PROCESSANDO_PAGINAS', percentual: null, paginasProcessadas: 1,
        itensDescobertos: 5, itensPulados: 0, itensComErro: 0,
        progressoEm: discoveryState.progress[0].progressoEm,
    });
});
