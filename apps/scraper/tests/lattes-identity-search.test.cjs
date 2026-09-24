const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
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
test('busca aguarda o resultado sem depender do metodo da resposta', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent('<button id="buscar">Buscar</button>');
        await page.locator('#buscar').evaluate(button => button.addEventListener('click', () => {
            setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<div class="resultado">Resultado</div>'), 50);
        }));
        await submitLattesSearch(page, () => page.click('#buscar'));
        assert.equal(await page.locator('.resultado').textContent(), 'Resultado');
    } finally { await browser.close(); }
});
test('falha na busca salva HTML e metadados sem substituir o erro original', async () => {
    const diagnosticsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oda-lattes-diagnostic-'));
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent('<form><input id="textoBusca"><div class="alert">Servico indisponivel</div></form>');
        await assert.rejects(
            submitLattesSearch(page, async () => undefined, {
                lattesId: '0008785408235675',
                nome: 'Pesquisador Teste',
                tentativa: 2,
                timeoutMs: 20,
                diagnosticsDir,
            }),
            /Timeout/,
        );
        const files = await fs.readdir(diagnosticsDir);
        const htmlFile = files.find(file => file.endsWith('.html'));
        const metadataFile = files.find(file => file.endsWith('.json'));
        assert.ok(htmlFile);
        assert.ok(metadataFile);
        assert.match(await fs.readFile(path.join(diagnosticsDir, htmlFile), 'utf8'), /Servico indisponivel/);
        const metadata = JSON.parse(await fs.readFile(path.join(diagnosticsDir, metadataFile), 'utf8'));
        assert.equal(metadata.lattesId, '0008785408235675');
        assert.equal(metadata.tentativa, 2);
        assert.equal(metadata.seletores.campoBusca, 1);
        assert.equal(metadata.seletores.mensagemErro, 1);
        assert.match(metadata.erro, /Timeout/);
    } finally {
        await browser.close();
        await fs.rm(diagnosticsDir, { recursive: true, force: true });
    }
});
