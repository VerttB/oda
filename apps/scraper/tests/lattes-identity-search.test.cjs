const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const { extractLattesId } = require('../src/common/lattesIdentity');
const { submitLattesSearch } = require('../src/common/lattesSearchNavigation');
const { LattesParser } = require('../src/parsers/lattesParser');
const read = content => extractLattesId(cheerio.load(`<div class="informacoes-autor">${content}</div>`));
test('ID rotulado independe da posicao e preserva zeros iniciais', () => {
    assert.equal(read('<li>ID Lattes: <span>0008785408235675</span></li><li>Outro campo</li><li>Atualizado</li>'), '0008785408235675');
});
test('aceita endereco canonico e rejeita valor invalido ou contraditorio', () => {
    assert.equal(read('<a href="https://lattes.cnpq.br/0008785408235675">CV</a>'), '0008785408235675');
    assert.throws(() => read('<li>ID Lattes: 1234</li>'), /sem ID/);
    assert.throws(() => read('<li>ID Lattes: 00087854082356750</li>'), /sem ID/);
    assert.throws(() => read('<li>ID Lattes: 0008785408235675</li><a href="http://lattes.cnpq.br/9999999999999999">CV</a>'), /conflitantes/);
});
test('parser de projetos encerra quando nao existe bloco de descricao', () => {
    const $ = cheerio.load(`
        <a name="ProjetosPesquisa"></a>
        <div class="layout-cell layout-cell-12 data-cell">
            <div class="layout-cell-3 text-align-right"><b>2020 - Atual</b></div>
            <div>Projeto sem descricao</div><div></div>
        </div>
    `);
    const projects = new LattesParser().extractProjectDetails($);
    assert.equal(projects.projetoPesquisa.length, 1);
    assert.equal(projects.projetoPesquisa[0].nome, 'Projeto sem descricao');
});
test('busca aceita resposta POST com resultado igual e navegacao completa', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('https://lattes.test/**', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({ contentType: 'text/html', body: '<div class="resultado">Pagina nova</div>' });
                return;
            }
            await route.fulfill({ contentType: 'text/html', body: '<div class="resultado">Resultado igual</div>' });
        });
        await page.goto('https://lattes.test/buscatextual/busca.do');
        await submitLattesSearch(page, () => page.evaluate(async () => {
            await fetch('/buscatextual/busca.do', { method: 'POST' });
        }));
        assert.equal(await page.locator('.resultado').textContent(), 'Resultado igual');
        await submitLattesSearch(page, () => page.evaluate(() => {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/buscatextual/busca.do';
            document.body.appendChild(form);
            form.submit();
        }));
        assert.equal(await page.locator('.resultado').textContent(), 'Pagina nova');
    } finally { await browser.close(); }
});
