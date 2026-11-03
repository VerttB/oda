// Redis descartável + executor simulado. Não acessa PostgreSQL nem serviços de IA.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { AiQueueClient, AiQueueError, createAiQueue, QUEUE_NAMES, AI_JOB_NAMES, Worker } = require('@oda/queue');
const { createAiProcessor } = require('../dist/queue/aiProcessor');
const container = `oda-ai-test-${process.pid}-${randomBytes(4).toString('hex')}`;
const prefix = `test-ai-${randomUUID()}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fetch = (url, init = {}) => globalThis.fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const response = { output: 'Resposta simulada [S1]', model: 'modelo-teste', provider: 'local', createdAt: '2026-10-29T00:00:00.000Z', sources: [{ ref: 'S1', sourceType: 'grupo_pesquisa', sourceId: 'group-test', title: 'Grupo simulado', excerpt: 'Trecho simulado.' }], grounded: true, retrievalAttempts: 1 };
let app, worker, queue, started = false;
const clients = [];
let connection;
const executions = [];

function client(options = {}) {
  const value = new AiQueueClient({ connection, prefix, waitTimeoutMs: 1500, readinessTimeoutMs: 500, ...options });
  clients.push(value);
  return value;
}

async function main() {
  try {
    docker('run', '--rm', '-d', '--name', container, '-p', '127.0.0.1::6379', 'redis:7-alpine', '--save', '', '--appendonly', 'no');
    started = true;
    for (let attempt = 0; ; attempt++) {
      try { assert.equal(docker('exec', container, 'redis-cli', 'ping'), 'PONG'); break; }
      catch (error) { if (attempt > 50) throw error; await pause(100); }
    }
    const port = Number(docker('port', container, '6379/tcp').split(':').at(-1));
    connection = { host: '127.0.0.1', port, maxRetriesPerRequest: 1, connectTimeout: 300, enableOfflineQueue: false, retryStrategy: () => 100, commandTimeout: 500 };
    queue = createAiQueue(connection, prefix);
    queue.on('error', () => {});
    await queue.waitUntilReady();
    const gateway = client();
    await assert.rejects(gateway.health(), (error) => error instanceof AiQueueError && error.reason === 'UNAVAILABLE');
    assert.equal(await queue.count(), 0);
    console.log('PASS: ausência de worker retorna indisponibilidade sem publicar trabalho órfão.');

    const execute = async (data) => {
      executions.push(data);
      if (data.payload.prompt === 'falhar') throw new Error('Detalhe privado do provedor');
      if (data.payload.prompt === 'demorar') await pause(250);
      if (data.payload.prompt === 'invalido') return { operation: 'summarize', result: response };
      return data.operation === 'semantic-search'
        ? { operation: data.operation, result: { results: [{ sourceId: 'work-test', score: 0.4 }], totalItems: 1 } }
        : { operation: data.operation, result: { ...response, output: data.operation === 'summarize' ? 'Resumo simulado' : response.output } };
    };
    worker = new Worker(QUEUE_NAMES.AI, createAiProcessor(execute), { connection: { ...connection, commandTimeout: undefined, enableOfflineQueue: true, maxRetriesPerRequest: null }, prefix, concurrency: 1 });
    worker.on('error', () => {});
    await worker.waitUntilReady();
    await pause(50);
    assert.equal((await gateway.health()).transport, 'bullmq');
    assert.deepEqual(await gateway.request('generate', { prompt: 'teste', chatHistory: 'histórico de teste' }), response);
    assert.equal((await gateway.request('summarize', { text: 'texto', instructions: 'resuma' })).output, 'Resumo simulado');
    const semanticPayload = { query: 'saúde', type: 'PRODUCAO', limit: 10, offset: 20, filters: { qualis: 'A1' } };
    assert.equal((await gateway.request('semantic-search', semanticPayload)).totalItems, 1);
    assert.deepEqual(executions.at(-1).payload, semanticPayload);
    const completed = await queue.getJobs(['completed']);
    assert.equal(completed.length, 3);
    assert.equal(new Set(completed.map((job) => job.id)).size, 3);
    assert.ok(completed.every((job) => job.progress.etapa === 'CONCLUIDO'));
    console.log('PASS: geração, resumo e busca semântica executados por jobs reais; contratos, filtros e contexto preservados.');

    await assert.rejects(gateway.request('generate', { prompt: 'falhar' }), (error) => error.reason === 'FAILED');
    await assert.rejects(gateway.request('generate', { prompt: 'invalido' }), (error) => error.reason === 'FAILED');
    assert.equal(executions.filter((data) => data.payload.prompt === 'falhar').length, 1);
    const beforeExpired = executions.length;
    const id = randomUUID();
    const expired = await queue.add(AI_JOB_NAMES.generate, { version: 1, operation: 'generate', requestId: id, expiresAt: Date.now() - 1, payload: { prompt: 'expirado' } });
    await pause(80);
    assert.equal(await expired.getState(), 'failed');
    assert.equal(executions.length, beforeExpired);
    console.log('PASS: falha e contrato incorreto não geram falso sucesso; job expirado não chama o executor.');

    const short = client({ waitTimeoutMs: 60 });
    await assert.rejects(short.request('generate', { prompt: 'demorar' }), (error) => error.reason === 'TIMEOUT');
    await pause(300);
    const late = (await queue.getJobs(['completed'])).find((job) => job.data.payload.prompt === 'demorar');
    assert.ok(late, 'Trabalho ativo pode terminar depois da espera HTTP; não foi anunciado como cancelado.');
    console.log('PASS: prazo de espera é limitado; conclusão tardia não vira cancelamento fictício.');

    const disconnecting = client();
    const previous = executions.filter((data) => data.payload.prompt === 'demorar').length;
    const waiting = disconnecting.request('generate', { prompt: 'demorar' }).then(() => null, (error) => error);
    for (let attempt = 0; executions.filter((data) => data.payload.prompt === 'demorar').length === previous; attempt++) {
      assert.ok(attempt < 100, 'Job não iniciou para o teste de encerramento.');
      await pause(5);
    }
    await disconnecting.close();
    assert.equal((await waiting).reason, 'FAILED');
    await pause(300);
    console.log('PASS: encerrar o cliente durante uma consulta rejeita a espera e libera os listeners.');

    // Exercita também a configuração sem prefixo de testes, usada no Docker real.
    const defaultClient = client({ prefix: undefined });
    const defaultWorker = new Worker(QUEUE_NAMES.AI, createAiProcessor(execute), {
      connection: { ...connection, commandTimeout: undefined, enableOfflineQueue: true, maxRetriesPerRequest: null }, concurrency: 1,
    });
    defaultWorker.on('error', () => {});
    try {
      await defaultWorker.waitUntilReady();
      await pause(30);
      assert.equal((await defaultClient.request('generate', { prompt: 'prefixo padrão' })).output, response.output);
    } finally { await defaultWorker.close(); await defaultClient.close(); }
    console.log('PASS: prefixo padrão da fila e do worker coincide, como na execução Docker.');

    await checkHttp(gateway, port);

    await worker.close(); worker = undefined;
    await assert.rejects(gateway.health(), (error) => error.reason === 'UNAVAILABLE');
    docker('stop', '-t', '1', container); started = false;
    const start = Date.now();
    await assert.rejects(gateway.health(), (error) => error.reason === 'UNAVAILABLE');
    assert.ok(Date.now() - start < 2000);
    const down = client({ connection: { ...connection, retryStrategy: () => null } });
    await assert.rejects(down.health(), (error) => error.reason === 'UNAVAILABLE');
    assert.equal((await fetch(`${await app.getUrl()}/producoes`)).status, 200);
    console.log('PASS: Redis desligado devolve erro limitado; consulta pública independente continua respondendo.');
  } catch (error) {
    console.error('FAIL antes do encerramento:', error);
    throw error;
  } finally {
    if (worker) await worker.close();
    if (app) await app.close();
    await Promise.all(clients.map((value) => value.close()));
    if (queue) await queue.close();
    if (started) docker('stop', '-t', '1', container);
  }
}

async function checkHttp(gateway, redisPort) {
  console.log('INFO: iniciando controladores reais da API para validação HTTP.');
  apiRequire('ts-node').register({ project: path.join(root, 'apps/api/tsconfig.json'), transpileOnly: true });
  apiRequire('tsconfig-paths').register({ baseUrl: path.join(root, 'apps/api'), paths: { '@/*': ['src/*'] } });
  const { Test } = apiRequire('@nestjs/testing');
  const { APP_PIPE, APP_INTERCEPTOR } = apiRequire('@nestjs/core');
  const { ZodValidationPipe, ZodSerializerInterceptor, cleanupOpenApiDoc } = apiRequire('nestjs-zod');
  const { SwaggerModule, DocumentBuilder } = apiRequire('@nestjs/swagger');
  const { ConfigService } = apiRequire('@nestjs/config');
  const { JwtService } = apiRequire('@nestjs/jwt');
  const { CACHE_MANAGER } = apiRequire('@nestjs/cache-manager');
  const apiSource = (file) => apiRequire(path.join(root, 'apps/api/src', file));
  const { LangchainController } = apiSource('resources/langchain/langchain.controller');
  const { LangchainGatewayService } = apiSource('resources/langchain/langchain.service');
  const { ProducoesController } = apiSource('resources/producoes/producoes.controller');
  const { ProducoesService } = apiSource('resources/producoes/producoes.service');
  const { PrismaService } = apiSource('prisma/prisma.service');
  const { AiAccessGuard } = apiSource('common/rate-limit/ai-access.guard');
  const { RedisRateLimitService } = apiSource('common/rate-limit/redis-rate-limit.service');
  const jwt = new JwtService({ secret: randomBytes(32).toString('hex') });
  const work = { id: 'work-test', titulo: 'Trabalho simulado', ano: 2024, tipo: 'ARTIGO', doi: null, url: null, veiculo: null, resumo: null, issn: null, qualis: null };
  const module = await Test.createTestingModule({
    controllers: [LangchainController, ProducoesController],
    providers: [LangchainGatewayService, ProducoesService, AiAccessGuard, RedisRateLimitService,
      { provide: AiQueueClient, useValue: gateway },
      { provide: JwtService, useValue: jwt },
      { provide: ConfigService, useValue: new ConfigService({ REDIS_URL: `redis://127.0.0.1:${redisPort}` }) },
      { provide: PrismaService, useValue: { producao: { findMany: async () => [work], count: async () => 1 }, $transaction: async (promises) => Promise.all(promises) } },
      { provide: CACHE_MANAGER, useValue: { get: async () => undefined, set: async () => {}, del: async () => {}, wrap: async (_key, callback) => callback() } },
      { provide: APP_PIPE, useClass: ZodValidationPipe },
      { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ sub: 'admin-test', role: 'ADMIN' })}` };
  const post = (body, auth = true) => fetch(`${base}/langchain/generate`, { method: 'POST', headers: auth ? headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ prompt: '' })).status, 400);
  const generated = await post({ prompt: 'HTTP de teste' });
  assert.equal(generated.status, 201);
  assert.deepEqual(await generated.json(), response);
  const summary = await fetch(`${base}/langchain/summarize`, { method: 'POST', headers, body: JSON.stringify({ text: 'Texto de teste' }) });
  assert.equal(summary.status, 201);
  assert.equal((await summary.json()).output, 'Resumo simulado');
  for (const route of ['/producoes?q=saude&modoBusca=semantica', '/producoes/busca-semantica?q=saude']) {
    const result = await fetch(base + route, { headers });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data[0].id, work.id);
  }
  const fail = await post({ prompt: 'falhar' });
  assert.equal(fail.status, 503);
  assert.equal(JSON.stringify(await fail.json()).includes('Detalhe privado'), false);
  assert.equal((await post({ prompt: 'visitante' }, false)).status, 201);
  assert.equal((await fetch(`${base}/producoes/busca-semantica?q=saude`)).status, 200);
  const limited = await post({ prompt: 'terceira consulta' }, false);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('Retry-After')) > 0);
  assert.equal((await post({ prompt: 'admin continua' })).status, 201);
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Test').setVersion('1').build()));
  assert.ok(document.paths['/langchain/generate'].post.responses['201']);
  assert.ok(document.paths['/langchain/generate'].post.responses['503']);
  assert.ok(document.paths['/langchain/generate'].post.responses['504']);
  console.log('PASS: HTTP real mantém contratos, aliases, validação Zod, Swagger e limite compartilhado; administrador autenticado preservado.');
}

main().then(() => console.log('PASS: integração IA/BullMQ concluída; Redis temporário removido.')).catch((error) => { console.error(error); process.exitCode = 1; });
