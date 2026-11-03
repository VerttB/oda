// HTTP e controllers reais. Persistência, fila e contador Redis são simulados.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
require('ts-node').register({ project: path.join(__dirname, '../tsconfig.json'), transpileOnly: true });
require('tsconfig-paths').register({ baseUrl: path.join(__dirname, '..'), paths: { '@/*': ['src/*'] } });
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { Reflector } = require('@nestjs/core');
const { SwaggerModule } = require('@nestjs/swagger');
const { ZodSerializerInterceptor, ZodValidationPipe } = require('nestjs-zod');
const request = require('supertest');
const source = file => require(path.join(__dirname, '../src', file));
const { configureApiVersioning } = source('common/api-versioning');
const { createApiDocument } = source('common/openapi');
const { JwtAuthGuard } = source('common/auth/jwt-auth.guard');
const { JwtStrategy } = source('resources/auth/jwt.strategy');
const { RedisRateLimitService } = source('common/rate-limit/redis-rate-limit.service');
const { DGP_QUEUE } = source('resources/filas/filas.constants');

const resources = [
  ['area-conhecimento', 'AreaConhecimento'], ['auth', 'Auth'], ['filas', 'Filas'],
  ['grupos-pesquisa', 'GruposPesquisa'], ['instituicao', 'Instituicao'],
  ['langchain', 'Langchain'], ['linha-pesquisa', 'LinhaPesquisa'],
  ['metricas', 'Metricas'], ['pesquisadores', 'Pesquisadores'],
  ['producoes', 'Producoes'], ['uf', 'Uf'],
];
const controllers = resources.map(([directory, name]) => source(`resources/${directory}/${directory}.controller`)[`${name}Controller`]);
const services = Object.fromEntries(resources.map(([directory, name]) => [
  name, source(`resources/${directory}/${directory}.service`)[name === 'Langchain' ? 'LangchainGatewayService' : `${name}Service`],
]));
const { AppController } = source('app.controller');
const { AppService } = source('app.service');
const jwtSecret = randomBytes(32).toString('hex');
const jwt = new JwtService({ secret: jwtSecret });
const adminToken = jwt.sign({ sub: 'admin-version-test', role: 'ADMIN' });
const counters = new Map();
const calls = [];
const limiter = {
  async consume(scope, identity, limit) {
    calls.push({ scope, identity });
    const key = `${scope}:${identity}`;
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);
    return { allowed: count <= limit, limit, remaining: Math.max(0, limit - count), retryAfterMs: 60000 };
  },
};
const emptyPage = { data: [], meta: { page: 1, size: 30, totalItems: 0, totalPages: 0 } };
const response = { output: 'Resposta simulada.', model: 'modelo-teste', provider: 'local', createdAt: '2026-11-03T00:00:00Z' };
const implementations = {
  Auth: { login: async () => ({ access_token: adminToken }) },
  Filas: { findActiveWorkers: async () => ({ total: 0, workers: [] }) },
  GruposPesquisa: { findAll: async () => emptyPage },
  Producoes: { findAll: async () => emptyPage },
  Langchain: { generate: async () => response, summarize: async () => response },
};
let app, directory;

before(async () => {
  const module = await Test.createTestingModule({
    controllers: [AppController, ...controllers],
    providers: [AppService, JwtStrategy,
      { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: jwtSecret }) },
      { provide: JwtService, useValue: jwt },
      { provide: RedisRateLimitService, useValue: limiter },
      { provide: DGP_QUEUE, useValue: { getWorkers: async () => [] } },
      ...Object.entries(services).map(([name, provide]) => ({ provide, useValue: implementations[name] ?? {} })),
    ],
  }).compile();
  app = module.createNestApplication({ logger: false });
  configureApiVersioning(app);
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ZodSerializerInterceptor(app.get(Reflector)));
  directory = await mkdtemp(path.join(tmpdir(), 'oda-api-version-'));
  await writeFile(path.join(directory, 'asset.txt'), 'Arquivo estático de teste.');
  app.useStaticAssets(directory, { prefix: '/static/' });
  SwaggerModule.setup('api', app, createApiDocument(app));
  await app.init();
});
beforeEach(() => { counters.clear(); calls.length = 0; });
after(async () => {
  if (app) await app.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test('publica consultas em /v1 e rejeita caminhos sem versão ou com versão inexistente', async () => {
  const http = request(app.getHttpServer());
  await http.get('/v1/').expect(200, 'Hello World!');
  await http.get('/v1/grupos-pesquisa').expect(200, emptyPage);
  await http.get('/v1/producoes').expect(200, emptyPage);
  for (const route of ['/', '/grupos-pesquisa', '/producoes', '/v2/grupos-pesquisa']) await http.get(route).expect(404);
  assert.equal(calls.length, 0);
});

test('preserva login público e exige JWT nas operações administrativas versionadas', async () => {
  const http = request(app.getHttpServer());
  await http.post('/v1/auth/login').send({ username: 'teste', password: 'senha-de-teste' }).expect(200, { access_token: adminToken });
  await http.get('/v1/admin/filas/workers').expect(401);
  await http.get('/v1/admin/filas/workers').auth(adminToken, { type: 'bearer' }).expect(200, { total: 0, workers: [] });
  await http.post('/v1/producoes').send({}).expect(401);
  const expired = jwt.sign({ sub: 'admin', role: 'ADMIN' }, { expiresIn: -1 });
  await http.get('/v1/admin/filas/workers').auth(expired, { type: 'bearer' }).expect(401);
});

test('compartilha a cota entre alias semântico, consulta atual e chatbot em /v1', async () => {
  const http = request(app.getHttpServer());
  await http.get('/v1/grupos-pesquisa/busca-semantica?q=educacao').expect(200);
  await http.get('/v1/producoes?q=educacao&modoBusca=semantica').expect(200);
  const blocked = await http.post('/v1/langchain/generate').send({ prompt: 'Pergunta de teste' }).expect(429);
  assert.ok(Number(blocked.headers['retry-after']) > 0);
  assert.ok(calls.every(call => call.scope === 'ai'));
  assert.equal(new Set(calls.map(call => call.identity)).size, 1);
  await http.post('/v1/langchain/generate').auth(adminToken, { type: 'bearer' }).send({ prompt: 'Administrador' }).expect(201);
  assert.equal(calls.length, 3);
});

test('documenta as 81 operações em /v1 e preserva a política de segurança no Swagger', async () => {
  const { body: document } = await request(app.getHttpServer()).get('/api-json').expect(200);
  assert.ok(Object.keys(document.paths).every(route => /^\/v1(?:\/|$)/.test(route)));
  const methods = new Set(['get', 'post', 'patch', 'delete', 'put', 'options', 'head', 'trace']);
  const operations = Object.values(document.paths).flatMap(item => Object.keys(item)).filter(key => methods.has(key));
  assert.equal(operations.length, 81);
  assert.deepEqual(document.paths['/v1/producoes'].post.security, [{ bearer: [] }]);
  assert.deepEqual(document.paths['/v1/admin/filas/workers'].get.security, [{ bearer: [] }]);
  assert.equal(document.paths['/v1/auth/login'].post.security, undefined);
  assert.deepEqual(document.paths['/v1/langchain/generate'].post.security, [{ bearer: [] }, {}]);
  assert.deepEqual(document.paths['/v1/producoes/busca-semantica'].get.security, [{ bearer: [] }, {}]);
  await request(app.getHttpServer()).get('/api/').expect(200);
});

test('oculta administração e escrita no documento de produção, preservando login e IA', () => {
  const document = createApiDocument(app, true);
  assert.ok(!Object.keys(document.paths).some(route => route.startsWith('/v1/admin/filas')));
  assert.equal(document.paths['/v1/producoes'].post, undefined);
  assert.equal(document.paths['/v1/producoes/{id}'].patch, undefined);
  assert.ok(document.paths['/v1/auth/login'].post);
  assert.ok(document.paths['/v1/langchain/generate'].post);
  assert.ok(document.paths['/v1/langchain/summarize'].post);
  assert.ok(document.paths['/v1/producoes/busca-semantica'].get);
});

test('mantém arquivos estáticos em /static, fora do versionamento dos controllers', async () => {
  await request(app.getHttpServer()).get('/static/asset.txt').expect(200, 'Arquivo estático de teste.');
  await request(app.getHttpServer()).get('/v1/static/asset.txt').expect(404);
});
