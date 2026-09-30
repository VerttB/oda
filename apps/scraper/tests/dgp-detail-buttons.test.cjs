const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const path = require('node:path');
const { chromium } = require('playwright');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { DGP_DETAIL_SELECTORS, readDgpDetailButtons, resolveDgpDetailButton } = require('../src/common/dgpDetailButtons');

let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

function row(id, nome) {
    return `<tr><td>${nome}</td><td><a id="${id}" href="#" onclick="document.body.dataset.clicked=this.id; return false;">Detalhes</a></td></tr>`;
}
const rhId = i => `form:rh:${i}:idBtnVisualizarEspelho`;
const rhHtml = indices => `<section id="recursosHumanos"><table>${indices.map(i => row(rhId(i), `Pessoa ${i}`)).join('')}</table></section>`;

test('RH exclui botoes de linhas e links fora da secao de recursos humanos', async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent(`${rhHtml([0, 1])}<table>${row('form:linha:0:idBtnVisualizarEspelhoLinhaPesquisa', 'Linha')}${row('form:outro:idBtnVisualizarEspelho', 'Outro')}</table>`);
    const buttons = await readDgpDetailButtons(page, DGP_DETAIL_SELECTORS.rh);
    assert.deepEqual(buttons.map(item => item.nome), ['Pessoa 0', 'Pessoa 1']);
    assert.equal((await readDgpDetailButtons(page, DGP_DETAIL_SELECTORS.lines)).length, 1);
});

test('sexto botao continua acessivel por ID quando a lista diminui e muda de ordem', async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent(rhHtml([0, 1, 2, 3, 4, 5]));
    const buttons = await readDgpDetailButtons(page, DGP_DETAIL_SELECTORS.rh);
    await page.setContent(rhHtml([5, 2, 1]));
    const button = await resolveDgpDetailButton(page, buttons[5]);
    await button.click();
    assert.equal(await page.getAttribute('body', 'data-clicked'), rhId(5));
});

test('nova navegacao permite reencontrar o botao sem manter handles antigos', async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.goto(`data:text/html,${encodeURIComponent(rhHtml([0, 1]))}`);
    const buttons = await readDgpDetailButtons(page, DGP_DETAIL_SELECTORS.rh);
    await page.goto(`data:text/html,${encodeURIComponent(rhHtml([1]))}`);
    await (await resolveDgpDetailButton(page, buttons[1])).click();
    assert.equal(await page.getAttribute('body', 'data-clicked'), rhId(1));
});

test('ID reutilizado por outra pessoa falha em vez de associar dados incorretos', async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.setContent(rhHtml([0]));
    const [item] = await readDgpDetailButtons(page, DGP_DETAIL_SELECTORS.rh);
    await page.setContent(`<table>${row(rhId(0), 'Outra pessoa')}</table>`);
    await assert.rejects(resolveDgpDetailButton(page, item), /Botao DGP divergente/);
    assert.equal(await page.getAttribute('body', 'data-clicked'), null);
});

test('botao realmente removido falha sem clicar no proximo item', async t => {
    const page = await browser.newPage();
    t.after(() => page.close());
    page.setDefaultTimeout(150);
    await page.setContent(rhHtml([0, 1]));
    const [item] = await readDgpDetailButtons(page, DGP_DETAIL_SELECTORS.rh);
    await page.setContent(rhHtml([1]));
    await assert.rejects(resolveDgpDetailButton(page, item), /Nao foi possivel resolver botao DGP/);
    assert.equal(await page.getAttribute('body', 'data-clicked'), null);
});
