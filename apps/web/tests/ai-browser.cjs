const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs/promises');
// Reutiliza o Playwright já instalado no workspace, sem adicionar dependências.
const { chromium } = createRequire(path.resolve(__dirname, '../../scraper/package.json'))('playwright');
const { group, person, work, line, paginated, answer } = require('./ai-fixtures.cjs');
const base = process.env.WEB_TEST_URL || 'http://127.0.0.1:4000';
const audit = path.resolve(__dirname, '../../..', 'audit', 'web-ai');
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
  await fs.mkdir(audit, { recursive: true });
});
after(async () => browser?.close());

async function setup(t, handler, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', ...options });
  t.after(() => context.close());
  const calls = [];
  const errors = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // Nenhuma chamada de IA alcança a API real ou um provedor externo.
    if (url.pathname.startsWith('/api/')) {
      calls.push({ url, method: request.method(), headers: request.headers(), body: request.postDataJSON() });
      return handler(route, calls.at(-1), calls.length);
    }
    if (url.origin !== new URL(base).origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, calls, errors };
}

const json = (route, body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers });
async function open(page, search = '') {
  await page.goto(`${base}/ia${search}`);
  await page.getByRole('heading', { name: 'Da pergunta à pesquisa' }).waitFor();
  await page.locator('main[data-ai-ready="true"]').waitFor();
  // Confere também a troca de ferramenta antes de iniciar cada cenário.
  await page.getByRole('tab', { name: 'Assistente', exact: true }).click();
  await page.getByRole('heading', { name: 'Converse com os dados do ODA' }).waitFor();
  if (!search.includes('modo=chat')) await page.getByRole('tab', { name: 'Busca semântica' }).click();
}

test('busca explícita, ordem semântica, parâmetros, paginação, URL e cache', async (t) => {
  const data = Array.from({ length: 10 }, (_, index) => group(`group-${index}`, index === 0 ? 'Zeta relevante' : index === 1 ? 'Alfa relevante' : `Grupo ${index}`));
  const { page, calls, errors } = await setup(t, async (route, call) => {
    const current = Number(call.url.searchParams.get('page'));
    await new Promise((resolve) => setTimeout(resolve, 250));
    return json(route, paginated(current === 2 ? [group('last', 'Último resultado')] : data, current, 11));
  });
  await open(page);
  await page.getByLabel('O que você está procurando?').fill('assunto sem palavras no título');
  assert.equal(calls.length, 0);
  await page.getByRole('button', { name: 'Buscar com IA' }).click();
  await page.getByText('Buscando registros relacionados ao tema…').waitFor();
  await page.getByRole('heading', { name: 'Zeta relevante' }).waitFor();
  const titles = await page.getByRole('list', { name: 'Resultados semânticos' }).getByRole('heading').allTextContents();
  assert.deepEqual(titles.slice(0, 2), ['Zeta relevante', 'Alfa relevante']);
  assert.equal(calls[0].url.searchParams.get('modoBusca'), 'semantica');
  assert.equal(calls[0].url.searchParams.get('q'), 'assunto sem palavras no título');
  assert.equal(calls[0].url.searchParams.get('size'), '10');
  assert.equal(calls[0].url.searchParams.has('ordenarPor'), false);
  assert.equal(calls[0].url.searchParams.has('nome'), false);
  assert.equal(new URL(page.url()).searchParams.get('q'), 'assunto sem palavras no título');
  await page.screenshot({ path: path.join(audit, 'busca-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Próxima' }).click();
  await page.getByRole('heading', { name: 'Último resultado' }).waitFor();
  assert.equal(calls.length, 2);
  assert.equal(new URL(page.url()).searchParams.get('page'), '2');
  await page.getByRole('button', { name: 'Anterior' }).click();
  await page.getByRole('heading', { name: 'Zeta relevante' }).waitFor();
  assert.equal(calls.length, 2, 'Retorno à página em cache não consome outra requisição');
  assert.deepEqual(errors, []);
});

test('abas usam endpoints reais, sem fabricar metadados, e tratam vazio', async (t) => {
  const { page, calls } = await setup(t, (route, call) => {
    const records = { '/api/grupos-pesquisa': [], '/api/pesquisadores': [person], '/api/producoes': [work], '/api/linha-pesquisa': [line] };
    return json(route, paginated(records[call.url.pathname]));
  });
  await open(page);
  await page.getByLabel('O que você está procurando?').fill('saúde');
  await page.getByRole('button', { name: 'Buscar com IA' }).click();
  await page.getByText(/Nenhum resultado para esta consulta/).waitFor();
  await page.getByRole('button', { name: 'Pesquisadores', exact: true }).click();
  await page.getByRole('heading', { name: person.nome }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Ver currículo Lattes' }).getAttribute('href'), `https://lattes.cnpq.br/${person.lattesId}`);
  await page.getByRole('button', { name: 'Produções', exact: true }).click();
  await page.getByRole('heading', { name: work.titulo }).waitFor();
  await page.getByRole('button', { name: 'Linhas de pesquisa', exact: true }).click();
  await page.getByRole('heading', { name: line.titulo }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Ver grupo da linha' }).getAttribute('href'), `/grupos/${line.grupoId}`);
  assert.deepEqual(calls.map((call) => call.url.pathname), ['/api/grupos-pesquisa', '/api/pesquisadores', '/api/producoes', '/api/linha-pesquisa']);
});

test('chat: JWT, contexto, fontes, segurança da renderização e preservação entre abas', async (t) => {
  const { page, context, calls, errors } = await setup(t, (route, call) => call.method === 'GET' ? json(route, paginated([])) : json(route, { ...answer, output: `${answer.output}\n\n<img src=x onerror="window.xssExecuted=true">\n[link inválido](javascript:alert(1))` }, 201));
  await context.addInitScript(() => sessionStorage.setItem('oda.admin.access-token', 'token-apenas-para-teste'));
  await open(page, '?modo=chat&q=consulta-preservada');
  assert.equal(calls.length, 0, 'Abrir o chat não dispara busca semântica oculta');
  await page.getByLabel('Sua pergunta').fill('O que o ACSO pesquisa?');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await page.getByRole('article', { name: 'Resposta do assistente' }).waitFor();
  await page.getByText('Fontes consultadas (1)', { exact: false }).click();
  await page.getByText(answer.sources[0].excerpt).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Ver registro' }).getAttribute('href'), '/grupos/group-test');
  assert.equal(calls[0].headers.authorization, 'Bearer token-apenas-para-teste');
  assert.deepEqual(Object.keys(calls[0].body), ['prompt']);
  assert.equal(await page.evaluate(() => window.xssExecuted), undefined);
  assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);
  assert.equal(await page.getByRole('article').locator('img').count(), 0);
  await page.screenshot({ path: path.join(audit, 'chat-fontes-desktop.png'), fullPage: true });
  await page.getByLabel('Sua pergunta').fill('Detalhe as linhas.');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await page.waitForFunction(() => document.querySelectorAll('article[aria-label="Resposta do assistente"]').length === 2);
  assert.match(calls[1].body.chatHistory, /O que o ACSO pesquisa\?/);
  assert.match(calls[1].body.chatHistory, /Resposta de/);
  assert.ok(calls[1].body.chatHistory.length <= 12_000);
  await page.getByRole('tab', { name: 'Busca semântica' }).click();
  await page.getByText(/Nenhum resultado para esta consulta/).waitFor();
  await page.getByRole('tab', { name: 'Assistente', exact: true }).click();
  assert.equal(await page.getByRole('article', { name: 'Resposta do assistente' }).count(), 2, 'Alternar as ferramentas preserva a conversa');
  // Recarregar encerra o histórico transitório.
  await page.goto(`${base}/ia?modo=chat`);
  await page.getByRole('button', { name: 'Limpar conversa' }).waitFor();
  assert.equal(await page.getByRole('article', { name: 'Resposta do assistente' }).count(), 0, 'Conversa não persiste após recarregar');
  assert.deepEqual(errors, []);
});

test('429: espera compartilhada, sem repetição automática ao alternar abas', async (t) => {
  const { page, calls } = await setup(t, (route) => json(route, { message: 'Limite' }, 429, { 'Retry-After': '3' }));
  await open(page);
  await page.getByLabel('O que você está procurando?').fill('saúde');
  await page.getByRole('button', { name: 'Buscar com IA' }).click();
  await page.getByRole('alert').getByText('Limite de uso de IA atingido.').waitFor();
  assert.ok(await page.getByRole('button', { name: 'Buscar com IA' }).isDisabled());
  await page.getByRole('tab', { name: 'Assistente', exact: true }).click();
  await page.getByLabel('Sua pergunta').fill('Outra pergunta');
  assert.ok(await page.getByRole('button', { name: 'Enviar pergunta' }).isDisabled());
  await page.getByRole('tab', { name: 'Busca semântica' }).click();
  await page.getByRole('button', { name: 'Buscar com IA' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled);
  assert.equal(calls.length, 1, 'Fim da espera e mudança de aba não repetem a consulta');
});

test('503 e resposta malformada: mensagem clara e nova tentativa explícita', async (t) => {
  const { page, calls } = await setup(t, (route, call, count) => count === 1 ? json(route, {}, 503) : count === 2 ? json(route, { data: 'inválido' }) : json(route, paginated([])));
  await open(page);
  await page.getByLabel('O que você está procurando?').fill('tema');
  await page.getByRole('button', { name: 'Buscar com IA' }).click();
  await page.getByRole('alert').getByText(/temporariamente indisponíveis/).waitFor();
  assert.equal(calls.length, 1);
  await page.getByRole('button', { name: 'Buscar com IA' }).click();
  await page.getByRole('alert').getByText(/resposta inesperada/).waitFor();
  await page.getByRole('button', { name: 'Buscar com IA' }).click();
  await page.getByText(/Nenhum resultado para esta consulta/).waitFor();
  assert.equal(calls.length, 3);
});

test('401: descarta sessão expirada; falha no chat mantém pergunta para tentar novamente', async (t) => {
  const { page, context, calls } = await setup(t, (route, call, count) => count === 1 ? json(route, {}, 401) : json(route, { ...answer, grounded: false, sources: [] }, 201));
  await context.addInitScript(() => sessionStorage.setItem('oda.admin.access-token', 'token-expirado-teste'));
  await open(page, '?modo=chat');
  await page.getByLabel('Sua pergunta').fill('Pergunta preservada');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await page.getByRole('alert').getByText(/Sua sessão expirou/).waitFor();
  assert.equal(await page.getByLabel('Sua pergunta').inputValue(), 'Pergunta preservada');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('oda.admin.access-token')), null);
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await page.getByText(/A revisão automática não confirmou/).waitFor();
  await page.getByText('A API não retornou fontes para esta resposta.').waitFor();
  assert.equal(calls[1].headers.authorization, undefined);
  await page.getByRole('button', { name: 'Limpar conversa' }).click();
  assert.equal(await page.getByRole('article', { name: 'Resposta do assistente' }).count(), 0);
});

test('cancelar espera não exibe sucesso e mantém o rascunho', async (t) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  t.after(() => release());
  const { page, calls } = await setup(t, async (route) => {
    await pending;
    await json(route, answer, 201).catch(() => {});
  });
  await open(page, '?modo=chat');
  await page.getByLabel('Sua pergunta').fill('Pergunta demorada');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await page.getByRole('button', { name: 'Cancelar espera' }).click();
  release();
  await page.getByText(/Espera cancelada/).waitFor();
  assert.equal(await page.getByRole('article', { name: 'Resposta do assistente' }).count(), 0);
  assert.equal(await page.getByLabel('Sua pergunta').inputValue(), 'Pergunta demorada');
  assert.equal(calls.length, 1);
});

test('tela móvel: busca, chat e fontes sem rolagem horizontal', async (t) => {
  const { page, errors } = await setup(t, (route, call) => json(route, call.method === 'POST' ? answer : paginated([group('mobile', 'Resultado móvel')])), { viewport: { width: 390, height: 844 } });
  await open(page);
  await page.getByLabel('O que você está procurando?').fill('pesquisa');
  await page.getByRole('button', { name: 'Buscar com IA' }).click();
  await page.getByRole('heading', { name: 'Resultado móvel' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(audit, 'busca-mobile.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Assistente', exact: true }).click();
  await page.getByLabel('Sua pergunta').fill('Pergunta móvel');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await page.getByText('Fontes consultadas (1)', { exact: false }).click();
  await page.getByText(answer.sources[0].excerpt).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(audit, 'chat-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
});

test('busca do cabeçalho usa o texto atual, sem depender do debounce', async (t) => {
  const { page, calls } = await setup(t, (route) => json(route, paginated([])));
  await open(page);
  const field = page.getByRole('textbox', { name: 'Busca semântica global' });
  await field.fill('energia renovável');
  await field.press('Enter');
  await page.getByText(/Nenhum resultado para esta consulta/).waitFor();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get('q'), 'energia renovável');
  assert.equal(await page.getByLabel('O que você está procurando?').inputValue(), 'energia renovável');
});

test('teclado alterna ferramentas sem executar consultas vazias', async (t) => {
  const { page, calls } = await setup(t, (route) => json(route, paginated([])));
  await open(page);
  const searchTab = page.getByRole('tab', { name: 'Busca semântica' });
  const chatTab = page.getByRole('tab', { name: 'Assistente', exact: true });
  await searchTab.focus();
  await searchTab.press('ArrowRight');
  await page.getByRole('heading', { name: 'Converse com os dados do ODA' }).waitFor();
  assert.equal(await chatTab.getAttribute('aria-selected'), 'true');
  assert.equal(await chatTab.evaluate((element) => element === document.activeElement), true);
  await chatTab.press('Home');
  await page.getByRole('heading', { name: 'Encontre pesquisas pelo significado' }).waitFor();
  assert.equal(await searchTab.getAttribute('aria-selected'), 'true');
  assert.equal(calls.length, 0);
});

test('504 informa que o worker pode continuar e não reenvia a pergunta', async (t) => {
  const { page, calls } = await setup(t, (route) => json(route, {}, 504));
  await open(page, '?modo=chat');
  await page.getByLabel('Sua pergunta').fill('Pergunta com espera excedida');
  await page.getByRole('button', { name: 'Enviar pergunta' }).click();
  await page.getByRole('alert').getByText(/O worker pode continuar processando/).waitFor();
  assert.equal(await page.getByLabel('Sua pergunta').inputValue(), 'Pergunta com espera excedida');
  assert.equal(await page.getByRole('article', { name: 'Resposta do assistente' }).count(), 0);
  assert.equal(calls.length, 1);
});
