const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const cheerio = require('cheerio');
require('ts-node').register({ transpileOnly: true, project: path.join(__dirname, '../tsconfig.json') });
const { LattesParser } = require('../src/parsers/lattesParser');

test('extrai hierarquias da seção AreasAtuacao', () => {
    const $ = cheerio.load(`
      <div class="title-wrapper">
        <a name="AreasAtuacao"><h1>Áreas de atuação</h1></a>
        <hr class="separator">
        <div class="layout-cell layout-cell-12 data-cell">
          <div class="layout-cell layout-cell-3"><b>1.</b></div>
          <div class="layout-cell layout-cell-9"><div class="layout-cell-pad-5">
            Grande área: Ciências Exatas e da Terra / Área: Ciência da Computação / Subárea: Metodologia e Técnicas da Computação/Especialidade: Banco de Dados.
          </div></div>
          <div class="layout-cell layout-cell-3"><b>2.</b></div>
          <div class="layout-cell layout-cell-9"><div class="layout-cell-pad-5">
            Grande área: Ciências Exatas e da Terra / Área: Ciência da Computação / Subárea: Metodologia e Técnicas da Computação/Especialidade: Engenharia de Software.
          </div></div>
        </div>
      </div>`);
    assert.deepEqual(new LattesParser().extractAreasAtuacao($), [
        'Ciências Exatas e da Terra > Ciência da Computação > Metodologia e Técnicas da Computação > Banco de Dados',
        'Ciências Exatas e da Terra > Ciência da Computação > Metodologia e Técnicas da Computação > Engenharia de Software',
    ]);
});

test('retorna lista vazia sem a seção', () => {
    assert.deepEqual(new LattesParser().extractAreasAtuacao(cheerio.load('<div></div>')), []);
});
