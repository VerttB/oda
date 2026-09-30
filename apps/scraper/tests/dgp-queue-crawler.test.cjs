const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
let state;
function replace(name, exports) {
    const id = require.resolve(name);
    require.cache[id] = { id, filename: id, loaded: true, exports };
}
replace('../src/common/config', {
    createCrawlerConfig: (_name, id) => ({ set: (key, value) => { state.config = { id, key, value }; } }),
    createCrawlerOptions: () => ({ maxRequestRetries: 3, maxSessionRotations: 10 }),
});
replace('../src/scrapers/dgpScraper', { scrapeGroupPage: async () => ({ arquivoJson: '1234567890123456.json' }) });
replace('crawlee', { PlaywrightCrawler: class {
    constructor(options) { state.options = options; }
    browserPool = { destroy: async () => { state.destroyed++; } };
    async run() {
        if (state.fatal) throw new Error('Storage indisponivel');
        if (state.navigationFailure) {
            await state.options.failedRequestHandler({}, new Error('Navigation timeout'));
            return;
        }
        if (!state.empty) await state.options.requestHandler({ page: {} });
    }
} });
const { collectDgpJob } = require('../src/queue/dgp/dgpSingleGroup');
beforeEach(() => { state = { destroyed: 0 }; });

test('uma tentativa BullMQ executa apenas uma tentativa Crawlee e libera o browser', async () => {
    assert.equal((await collectDgpJob('1234567890123456')).arquivoJson, '1234567890123456.json');
    assert.equal(state.options.maxRequestRetries, 0);
    assert.equal(state.options.maxSessionRotations, 0);
    assert.equal(state.config.value, false);
    assert.equal(state.destroyed, 1);
    const firstStorage = state.config.id;
    await collectDgpJob('1234567890123456');
    assert.notEqual(state.config.id, firstStorage);
});

test('failedRequestHandler nao vira sucesso silencioso e sempre fecha browser', async () => {
    state.navigationFailure = true;
    await assert.rejects(collectDgpJob('1234567890123456'), /Navigation timeout/);
    assert.equal(state.destroyed, 1);
});

test('queda fatal ou crawler vazio nao confirmam a coleta', async () => {
    state.fatal = true;
    await assert.rejects(collectDgpJob('1234567890123456'), /Storage indisponivel/);
    state.fatal = false;
    state.empty = true;
    await assert.rejects(collectDgpJob('1234567890123456'), /sem resultado/);
    assert.equal(state.destroyed, 2);
});
