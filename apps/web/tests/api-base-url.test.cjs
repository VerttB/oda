const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
// Executa a função real sem carregar import.meta.env ou precisar de um navegador.
const source = readFileSync(path.join(__dirname, '../src/api/base-url.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const apiModule = { exports: {} };
runInNewContext(compiled.outputText, { exports: apiModule.exports });
const { getApiUrls } = apiModule.exports;

test('acrescenta /v1 uma vez, com ou sem versão e barra final na configuração', () => {
  for (const base of ['https://oda.example', 'https://oda.example/', 'https://oda.example/v1', ' https://oda.example/v1/ ']) {
    const urls = getApiUrls(base);
    assert.equal(urls.apiUrl, 'https://oda.example/v1');
    assert.equal(urls.rootUrl, 'https://oda.example');
  }
});

test('preserva o prefixo do proxy reverso e separa o endereço das imagens', () => {
  const urls = getApiUrls('https://oda.example/backend/v1/');
  assert.equal(urls.apiUrl + '/grupos-pesquisa', 'https://oda.example/backend/v1/grupos-pesquisa');
  assert.equal(urls.rootUrl + '/static/foto.jpg', 'https://oda.example/backend/static/foto.jpg');
});

test('proxy local usa /api/v1 nas consultas e /api/static nas imagens', () => {
  const urls = getApiUrls('/api');
  assert.equal(urls.apiUrl + '/auth/login', '/api/v1/auth/login');
  assert.equal(urls.rootUrl + '/static/foto.jpg', '/api/static/foto.jpg');
});

test('configuração vazia continua produzindo erro claro', () => {
  assert.throws(() => getApiUrls('  '), /VITE_PUBLIC_BASE_URL/);
});
