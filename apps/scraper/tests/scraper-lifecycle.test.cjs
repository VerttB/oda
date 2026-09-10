const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });

let state;
const values = (...names) => Object.fromEntries(names.map(name => [name, name]));
const database = {
    FilaExtracaoStatus: values('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO'),
    TipoErroColeta: values('DESCONHECIDO', 'NAO_ENCONTRADO'),
    StatusSessao: values('ERRO', 'CONCLUIDO'),
    StatusItemLog: values('ERRO', 'SUCESSO'),
    TipoEntidadeLog: values('PESQUISADOR', 'GRUPO'),
    ModuloSistema: values('SCRAPER'),
    ModoExecucao: values('APENAS_LATTES', 'APENAS_DGP'),
    PipelineEtapa: values('PESQUISADOR_LATTES', 'SCRAPE_GROUP_PAGE'),
    SharedPipelineLogger: class {
        async startPipelineLogger() { return 'pipeline'; }
        async pipelineLogItem(_id, _step, status, options) {
            state.items.push({ status, ...options });
            return { id: `log-${state.items.length}` };
        }
        async finishPipelineLogger(_id, status, metadata) { state.finished = { status, metadata }; }
    },
};
function replaceModule(name, exports) {
    require.cache[require.resolve(name)] = { id: require.resolve(name), filename: require.resolve(name), loaded: true, exports };
}
replaceModule('@oda/database', database);
const db = {
    async resetProcessingResearchersQueue() {
        return { count: 0 };
    },
    async updatePesquisadorQueueStatus(id, status, error) {
        state.transitions.push({ id, status, error });
    },
    async updateGroupQueueStatus(id, status, error) {
        state.groupTransitions.push({ id, status, error });
    },
};
replaceModule('../src/common/database', {
    db,
    prisma: {
        filaExtracaoPesquisador: {
            async findMany(query) { state.query = query; return state.targets.slice(0, query.take); },
        },
        filaExtracaoGrupo: { async findMany() { return [{ dgpId: '1234567890123456', nome: 'Grupo' }]; } },
    },
});

class FakePage extends EventEmitter {
    constructor(id, popup = false, name = 'Pessoa') { super(); this.id = id; this.popup = popup; this.name = name; this.closed = false; }
    context() { return { route: async () => {} }; }
    async fill() {}
    async $() { return null; }
    async click() {}
    async waitForNavigation() {}
    async waitForLoadState() {}
    async waitForSelector() {}
    async waitForTimeout() {}
    async waitForResponse(predicate) {
        const request = {
            method: () => 'POST',
            resourceType: () => 'document',
        };
        const response = {
            request: () => request,
            url: () => 'https://buscatextual.cnpq.br/buscatextual/busca.do',
        };
        assert.equal(predicate(response), true);
        return response;
    }
    keyboard = { press: async () => {} };
    locator(selector) {
        const locator = {
            count: async () => selector === '.resultado b a' ? (state.noResults ? 0 : 1) : selector === 'img.foto' ? 1 : 0,
            first: () => locator,
            nth: () => locator,
            textContent: async () => 'Pessoa',
            getAttribute: async () => '/foto.jpg',
            click: async () => {},
            waitFor: async () => {},
            evaluateAll: async callback => {
                if (selector === '.resultado b a') {
                    if (state.noResults) return callback([]);
                    return callback([{
                        textContent: this.name,
                        getAttribute: () => '',
                        closest: () => null,
                    }]);
                }
                return callback([]);
            },
        };
        return locator;
    }
    frameLocator() {
        return { locator: () => ({ evaluate: async () => {
            const popup = new FakePage(this.id, true);
            state.popups.push(popup);
            this.emit('popup', popup);
        } }) };
    }
    waitForEvent(event) { return new Promise(resolve => this.once(event, resolve)); }
    async content() {
        if (state.popupError) throw new Error('HTML indisponivel');
        return `<div class="informacoes-autor"><ul><li><span>ID Lattes: ${state.wrongId ? '9999999999999999' : this.id}</span></li><li>Atualizado</li></ul></div>`;
    }
    url() { return 'https://buscatextual.cnpq.br/buscatextual/cv.do'; }
    request = { get: async () => ({
        ok: () => true,
        body: async () => Buffer.from('image'),
        dispose: async () => { state.responsesDisposed++; },
    }) };
    isClosed() { return this.closed; }
    async close() { this.closed = true; this.emit('close'); }
}

class FakeCrawler {
    constructor(options) {
        this.options = options;
        state.crawlers.push(this);
        this.browserPool = { destroy: async () => { state.destroyed++; } };
    }
    async addRequests(requests) { this.requests = requests; }
    async run() {
        if (state.dgpOnly) return;
        for (const request of this.requests) {
            request.retryCount = 0;
            for (;;) {
                const context = { request, page: new FakePage(request.userData.targetLattesId, false, request.userData.name) };
                for (const hook of this.options.preNavigationHooks) await hook(context, {});
                if (state.fatal && state.requestsHandled === 1) throw new Error('Storage indisponivel');
                try {
                    if (state.navigationError) throw new Error('Navigation timeout');
                    await this.options.requestHandler(context);
                    state.requestsHandled++;
                    break;
                } catch (error) {
                    if (request.retryCount === this.options.maxRequestRetries) {
                        await this.options.failedRequestHandler(context, error);
                        break;
                    }
                    await this.options.errorHandler(context, error);
                    request.retryCount++;
                }
            }
        }
    }
}
const crawlee = require('crawlee');
replaceModule('crawlee', { ...crawlee, PlaywrightCrawler: FakeCrawler, log: { info() {}, warning() {}, error() {} } });
const config = require('../src/common/config');
config.purgeCrawlerStorage = async () => {};
config.saveJson = data => {
    if (state.saveError) throw new Error('Disco cheio');
    state.saved.push(data);
    return 123;
};
const { runLattesScraper } = require('../src/scrapers/lattesScraper');
const { runDgpScraper } = require('../src/scrapers/dgpScraper');

beforeEach(() => {
    state = {
        targets: [{ nome: 'Pessoa', lattesId: '1234567890123456' }],
        transitions: [], groupTransitions: [], items: [], saved: [], crawlers: [], popups: [],
        responsesDisposed: 0, destroyed: 0, requestsHandled: 0,
    };
});

test('salva o JSON, conclui o item, libera foto e popup e agrega metricas', async t => {
    t.mock.method(fs.promises, 'writeFile', async () => {});
    await runLattesScraper();
    assert.equal(state.query.take, 500);
    assert.deepEqual(state.transitions.map(t => t.status), ['PROCESSANDO', 'CONCLUIDO']);
    assert.equal(state.saved[0].lattesId, state.targets[0].lattesId);
    assert.equal(state.responsesDisposed, 1);
    assert.ok(state.popups.every(p => p.closed));
    assert.equal(state.destroyed, 1);
    assert.equal(state.finished.status, 'CONCLUIDO');
    assert.equal(state.finished.metadata.tamanhoTotalBytes, 123);
    assert.equal(state.finished.metadata.pesquisadoresPendentes, 0);
});

test('falha ao gravar JSON nunca conclui a fila e fecha todos os popups', async () => {
    state.saveError = true;
    await runLattesScraper();
    assert.deepEqual(state.transitions.map(t => t.status), ['PROCESSANDO', 'ERRO']);
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].mensagemErro, 'Disco cheio');
    assert.equal(state.finished.metadata.retries, 3);
    assert.ok(state.popups.every(p => p.closed));
});

test('erro de navegacao esgota retries e vincula um unico erro na fila', async () => {
    state.navigationError = true;
    await runLattesScraper();
    assert.deepEqual(state.transitions.map(t => t.status), ['PROCESSANDO', 'ERRO']);
    assert.equal(state.transitions[1].error.ultimoErroId, 'log-1');
    assert.equal(state.finished.metadata.pesquisadoresComErro, 1);
    assert.equal(state.finished.metadata.retries, 3);
});

test('erro de popup permanece erro tecnico e nao vira nao encontrado', async () => {
    state.popupError = true;
    await runLattesScraper();
    assert.equal(state.items[0].tipoErro, 'DESCONHECIDO');
    assert.equal(state.items[0].mensagemErro, 'HTML indisponivel');
    assert.ok(state.popups.every(p => p.closed));
});

test('homonimo com ID diferente nao gera JSON e registra nao encontrado', async () => {
    state.wrongId = true;
    await runLattesScraper();
    assert.equal(state.saved.length, 0);
    assert.equal(state.items[0].tipoErro, 'NAO_ENCONTRADO');
    assert.equal(state.finished.metadata.retries, 0);
});

test('queda no meio do lote preserva os nao iniciados e as metricas ja coletadas', async t => {
    t.mock.method(fs.promises, 'writeFile', async () => {});
    state.targets = Array.from({ length: 30 }, (_, i) => ({ nome: `Pessoa ${i}`, lattesId: String(i + 1).padStart(16, '0') }));
    state.fatal = true;
    await assert.rejects(runLattesScraper(), /Storage indisponivel/);
    assert.deepEqual(state.transitions.map(t => [t.id, t.status]), [
        [state.targets[0].lattesId, 'PROCESSANDO'], [state.targets[0].lattesId, 'CONCLUIDO'],
        [state.targets[1].lattesId, 'PROCESSANDO'], [state.targets[1].lattesId, 'ERRO'],
    ]);
    assert.equal(state.crawlers.length, 1);
    assert.equal(state.finished.status, 'ERRO');
    assert.equal(state.finished.metadata.pesquisadoresExtraidos, 1);
    assert.equal(state.finished.metadata.pesquisadoresComErro, 1);
    assert.equal(state.finished.metadata.pesquisadoresPendentes, 28);
    assert.equal(state.destroyed, 1);
});

test('lotes seguintes so iniciam depois do encerramento do anterior', async () => {
    state.noResults = true;
    state.targets = Array.from({ length: 30 }, (_, i) => ({ nome: `Pessoa ${i}`, lattesId: String(i + 1) }));
    await runLattesScraper();
    assert.deepEqual(state.crawlers.map(c => c.requests.length), [15, 15]);
    assert.equal(state.destroyed, 2);
    assert.equal(state.finished.metadata.pesquisadoresComErro, 30);
});

test('DGP nao inicia Lattes ao terminar e registra falha definitiva de navegacao', async () => {
    state.dgpOnly = true;
    await runDgpScraper();
    assert.equal(state.crawlers.length, 1);
    assert.equal(state.query, undefined);
    const crawler = state.crawlers[0];
    await crawler.options.failedRequestHandler({ request: crawler.requests[0] }, new Error('Navigation timeout'));
    assert.equal(state.groupTransitions[0].status, 'ERRO');
    assert.equal(state.groupTransitions[0].error.ultimoErroId, 'log-1');
});

test('DGP aguarda load, inclusive quando o contexto ja possui bloqueio de recursos', async () => {
    for (const name of ['dgp', 'lattes', 'discovery']) {
        const context = { route: async () => {} };
        const hook = config.createCrawlerOptions(name).preNavigationHooks[0];
        for (let attempt = 0; attempt < 2; attempt++) {
            const gotoOptions = {};
            await hook({ page: { context: () => context } }, gotoOptions);
            assert.equal(gotoOptions.waitUntil, name === 'dgp' ? 'load' : 'domcontentloaded');
        }
    }
});

test('bloqueio do Lattes cobre contexto e preserva CSS e scripts', async () => {
    const context = {};
    let calls = 0;
    let routeHandler;
    context.route = async (_pattern, handler) => { calls++; routeHandler = handler; };
    const hook = config.createCrawlerOptions('lattes').preNavigationHooks[0];
    await hook({ page: { context: () => context } }, {});
    await hook({ page: { context: () => context } }, {});
    assert.equal(calls, 1);
    for (const type of ['image', 'font', 'media', 'stylesheet', 'script', 'document']) {
        let action;
        await routeHandler({ request: () => ({ resourceType: () => type }), abort: () => { action = 'abort'; }, continue: () => { action = 'continue'; } });
        assert.equal(action, ['image', 'font', 'media'].includes(type) ? 'abort' : 'continue');
    }
});
