const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
let state;
const replace = (name, exports) => {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
};
const enums = (...names) => Object.fromEntries(names.map(name => [name, name]));
replace('@oda/database', {
    FilaExtracaoStatus: enums('PROCESSANDO', 'CONCLUIDO', 'ERRO', 'PENDENTE'),
    TipoErroColeta: enums('DESCONHECIDO'), StatusSessao: enums('CONCLUIDO', 'ERRO'),
    StatusItemLog: enums('SUCESSO', 'ERRO'), TipoEntidadeLog: enums('GRUPO'),
    ModuloSistema: enums('SCRAPER'), ModoExecucao: enums('APENAS_DGP'),
    PipelineEtapa: enums('SCRAPE_GROUP_PAGE'),
    SharedPipelineLogger: class {
        async startPipelineLogger(_module, group) { state.sessions.push(group); return 'session'; }
        async pipelineLogItem(id, step, status, options) {
            state.items.push({ id, status, ...options }); return { id: `item-${state.items.length}` };
        }
        async finishPipelineLogger(id, status, metadata) { state.finished.push({ id, status, metadata }); }
    },
});
replace('../src/common/database', {
    prisma: { filaExtracaoGrupo: { findMany: async () => [{ dgpId: '0000000000000001' }, { dgpId: '0000000000000002' }] } },
    db: { updateGroupQueueStatus: async (id, status, error) => state.transitions.push({ id, status, error }) },
});
replace('../src/common/config', {
    DGP_TIMEOUTS: { popupMs: 30000, detailMs: 45000, mirrorMs: 60000 },
    SCRAPER_SETTINGS: { dgp: { take: 2, maxRequestRetries: 1, loginRetryDelayMs: 1 } }, CRAWLER_STORAGE_DIRS: { dgp: 'mock' },
    createCrawlerConfig: () => ({}), createCrawlerOptions: () => ({}),
    purgeCrawlerStorage: async () => {}, saveJson: () => 100,
});
replace('../src/common/utils', { randomSleep: async () => {} });
replace('../src/common/dgpDetailButtons', { DGP_DETAIL_SELECTORS: {}, readDgpDetailButtons: async () => [] });
replace('../src/parsers/dgpParser', { DGPExtractor: class {
    extractGroupMirror() { return { nome: 'Grupo', membros: [], linhas: [], instituicoes: [] }; }
} });
class Page extends EventEmitter {
    url() { return 'http://dgp.cnpq.br/dgp/espelhogrupo/1'; }
    async waitForSelector() {}
    async waitForLoadState() {}
    locator() { return { first: () => ({ waitFor: async () => {} }) }; }
    isClosed() { return false; }
    async evaluate() {
        if (state.readFailures-- > 0) throw new Error('Execution context was destroyed');
        return '<html>grupo</html>';
    }
}
replace('crawlee', {
    log: { info() {}, warning() {}, error() {} },
    PlaywrightCrawler: class {
        constructor(options) { this.options = options; }
        async addRequests(requests) { this.requests = requests; }
        async run() {
            for (const request of this.requests) {
                request.retryCount = 0;
                const context = { request, page: new Page() };
                for (;;) {
                    for (const hook of this.options.preNavigationHooks) await hook(context);
                    if (state.fatal && request.userData.dgpId === '0000000000000002') throw new Error('Storage failed');
                    try {
                    if (state.navigationFailure && request.userData.dgpId === '0000000000000002') throw new Error('Navigation timeout');
                        await this.options.requestHandler(context);
                        break;
                    } catch (error) {
                        if (request.retryCount++ < 1) continue;
                        request.retryCount = 1;
                        await this.options.failedRequestHandler(context, error);
                        break;
                    }
                }
            }
        }
    },
});
const { runDgpScraper } = require('../src/scrapers/dgpScraper');
const { readDgpPageContent } = require('../src/common/dgpPageContent');
beforeEach(() => { state = { sessions: [], items: [], finished: [], transitions: [], readFailures: 0 }; });
test('dois grupos compartilham uma sessao e geram dois resultados', async () => {
    await runDgpScraper();
    assert.deepEqual(state.sessions, [null]);
    assert.equal(state.items.length, 2);
    assert.ok(state.items.every(item => item.id === 'session' && item.status === 'SUCESSO'));
    assert.equal(state.finished.length, 1);
    assert.equal(state.finished[0].metadata.gruposExtraidos, 2);
    assert.equal(state.finished[0].metadata.tamanhoTotalBytes, 200);
});
test('falha do handler chega ao crawler e so gera item ao esgotar tentativas', async () => {
    state.readFailures = 6;
    await runDgpScraper();
    assert.deepEqual(state.items.map(item => item.status), ['ERRO', 'SUCESSO']);
    assert.equal(state.transitions.filter(t => t.id === '0000000000000001' && t.status === 'PROCESSANDO').length, 1);
    assert.equal(state.transitions.find(t => t.status === 'ERRO').error.ultimoErroId, 'item-1');
    assert.equal(state.finished[0].metadata.retries, 1);
    assert.equal(state.finished[0].status, 'ERRO');
});
test('falha antes do handler tambem gera um unico resultado definitivo', async () => {
    state.navigationFailure = true;
    await runDgpScraper();
    assert.deepEqual(state.items.map(item => item.status), ['SUCESSO', 'ERRO']);
});
test('interrupcao fatal finaliza sessao e item iniciado', async () => {
    state.fatal = true;
    await assert.rejects(runDgpScraper(), /Storage failed/);
    assert.equal(state.items.length, 2);
    assert.equal(state.finished[0].status, 'ERRO');
});
test('leitura repete navegacao transitoria e rejeita login', async () => {
    state.readFailures = 1;
    assert.equal(await readDgpPageContent(new Page(), '#recursosHumanos'), '<html>grupo</html>');
    const page = new Page();
    page.url = () => 'https://login.cnpq.br/auth/';
    await assert.rejects(readDgpPageContent(page, '#recursosHumanos'), /login/);
});
