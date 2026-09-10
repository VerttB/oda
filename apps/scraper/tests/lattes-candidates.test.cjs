const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const replace = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const values = (...names) => Object.fromEntries(names.map(n => [n, n]));
let state;
replace('@oda/database', {
    FilaExtracaoStatus: values('PROCESSANDO', 'CONCLUIDO', 'ERRO'),
    TipoErroColeta: values('DESCONHECIDO', 'NAO_ENCONTRADO'), StatusSessao: values('ERRO', 'CONCLUIDO'),
    StatusItemLog: values('ERRO', 'SUCESSO'), TipoEntidadeLog: values('PESQUISADOR'),
    ModuloSistema: values('SCRAPER'), ModoExecucao: values('APENAS_LATTES'), PipelineEtapa: values('PESQUISADOR_LATTES'),
    SharedPipelineLogger: class {
        async startPipelineLogger() { return 'session'; }
        async pipelineLogItem(id, step, status, options) { state.items.push({ status, ...options }); return { id: 'item' }; }
        async finishPipelineLogger() {}
    },
});
replace('../src/common/config', {
    SCRAPER_SETTINGS: { lattes: { take: 1, batchSize: 15, maxConcurrency: 1 } },
    CRAWLER_STORAGE_DIRS: { lattes: 'mock' }, LATTES_URL: 'https://lattes.test/',
    createCrawlerConfig: () => ({}), createCrawlerOptions: () => ({}), purgeCrawlerStorage: async () => {},
    saveJson: data => { state.saved.push(data); return 10; },
});
replace('../src/common/database', {
    db: { resetProcessingResearchersQueue: async () => ({ count: 0 }), updatePesquisadorQueueStatus: async (_, status) => state.status.push(status) },
    prisma: { filaExtracaoPesquisador: { findMany: async () => [{ nome: 'Pessoa', lattesId: '0008785408235675' }] } },
});
replace('../src/common/lattesSearchNavigation', { submitLattesSearch: async (_page, submit) => submit() });
const { extractLattesId } = require('../src/common/lattesIdentity');
replace('../src/parsers/lattesParser', { LattesParser: class {
    extractBasicInfo($) { return { lattes: extractLattesId($) }; }
    extractProductionDetails() { return {}; }
    extractProjectDetails() { return {}; }
    extractEventDetails() { return {}; }
    extractFormationDetails() { return {}; }
} });
class Page extends EventEmitter {
    pageNumber = 1;
    index = 0;
    async fill() {}
    async $() { return null; }
    async click() {}
    async waitForSelector() {}
    keyboard = { press: async () => {} };
    locator(selector) {
        const loc = {
            count: async () => 0,
            first: () => loc,
            nth: index => { this.index = index; return loc; },
            click: async () => {},
            evaluateAll: async () => selector === 'ol li' ? [] : state.pages[this.pageNumber - 1].map((_, index) => ({ index, nome: 'Pessoa', lattesId: '', source: 'result-link' })),
        };
        return loc;
    }
    async evaluate(_fn, arg) {
        if (arg) { this.pageNumber++; return; }
        return { currentPage: this.pageNumber, totalRecords: state.pages.length * 10, recordsPerPage: 10 };
    }
    frameLocator() { return { locator: () => ({ evaluate: async () => {
        const id = state.pages[this.pageNumber - 1][this.index];
        state.opened.push(id);
        let closed = false;
        this.emit('popup', {
            waitForLoadState: async () => {}, waitForSelector: async () => {},
            content: async () => `<div class="informacoes-autor"><li>ID Lattes: ${id}</li></div>`,
            locator: () => ({ first: () => ({ count: async () => 0 }) }),
            once() {}, isClosed: () => closed, close: async () => { closed = true; state.closed++; },
        });
    } }) }; }
    waitForEvent(event) { return new Promise(resolve => this.once(event, resolve)); }
}
replace('crawlee', {
    log: { info() {}, warning() {}, error() {} },
    PlaywrightCrawler: class {
        constructor(options) { this.options = options; }
        browserPool = { destroy: async () => {} };
        async addRequests(requests) { this.requests = requests; }
        async run() {
            for (const request of this.requests) {
                request.retryCount = 0;
                const context = { request, page: new Page() };
                for (const hook of this.options.preNavigationHooks) await hook(context);
                try { await this.options.requestHandler(context); }
                catch (error) { await this.options.failedRequestHandler(context, error); }
            }
        }
    },
});
const { runLattesScraper } = require('../src/scrapers/lattesScraper');
for (const [name, pages, expected] of [
    ['continua depois de homonimo na mesma pagina', [['9999999999999999', '0008785408235675']], 'SUCESSO'],
    ['continua na pagina seguinte', [['9999999999999999'], ['0008785408235675']], 'SUCESSO'],
    ['so marca nao encontrado depois de todos os candidatos', [['9999999999999999']], 'ERRO'],
    ['ID invalido permanece falha tecnica', [['invalido']], 'ERRO'],
]) test(name, async () => {
    state = { pages, opened: [], closed: 0, saved: [], status: [], items: [] };
    await runLattesScraper();
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].status, expected);
    assert.equal(state.opened.length, pages.flat().length);
    assert.equal(state.closed, state.opened.length);
    assert.equal(state.saved.length, expected === 'SUCESSO' ? 1 : 0);
    if (expected === 'SUCESSO') assert.equal(state.saved[0].lattesId, '0008785408235675');
    else assert.equal(state.items[0].tipoErro, pages[0][0] === 'invalido' ? 'DESCONHECIDO' : 'NAO_ENCONTRADO');
});
