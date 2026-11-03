// Banco descartável com dados sintéticos. Não lê nem usa DATABASE_URL do ambiente.
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '../../..');
const container = `oda-producoes-test-${process.pid}`;
const password = randomBytes(24).toString('hex');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let prisma;
let app;
let started = false;

async function main() {
  try {
    docker('run', '--rm', '-d', '--name', container, '-p', '127.0.0.1::5432',
      '-e', 'POSTGRES_DB=oda_producoes_test', '-e', `POSTGRES_PASSWORD=${password}`,
      'pgvector/pgvector:pg18-trixie');
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { docker('exec', container, 'pg_isready', '-U', 'postgres', '-d', 'oda_producoes_test'); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 300)); }
    }
    assert(ready, 'PostgreSQL temporário não iniciou.');
    const port = docker('port', container, '5432/tcp').split(':').at(-1);
    const url = `postgresql://postgres:${password}@127.0.0.1:${port}/oda_producoes_test`;
    process.env.DATABASE_URL = url;
    const migration = execFileSync(process.execPath,
      [path.join(root, 'shared/database/node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      { cwd: path.join(root, 'shared/database'), env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', timeout: 120_000 });
    assert(migration.includes('applied') || migration.includes('aplicad'), 'Migrations não aplicadas.');
    console.log('PASS: migrations aplicadas pelo Prisma em banco novo e isolado.');

    require('ts-node').register({ project: path.join(root, 'apps/api/tsconfig.json'), transpileOnly: true });
    require('tsconfig-paths').register({ baseUrl: path.join(root, 'apps/api'), paths: { '@/*': ['src/*'] } });
    const { PrismaClient, Prisma } = require('@oda/database');
    const { PrismaPg } = require('@prisma/adapter-pg');
    prisma = new PrismaClient({ adapter: new PrismaPg(url) });
    const { Test } = require('@nestjs/testing');
    const { APP_PIPE, APP_INTERCEPTOR } = require('@nestjs/core');
    const { ZodValidationPipe, ZodSerializerInterceptor } = require('nestjs-zod');
    const { CACHE_MANAGER } = require('@nestjs/cache-manager');
    const { JwtService } = require('@nestjs/jwt');
    const { ProducoesController } = require('../src/resources/producoes/producoes.controller');
    const { ProducoesService } = require('../src/resources/producoes/producoes.service');
    const { PrismaService } = require('../src/prisma/prisma.service');
    const { LangchainGatewayService } = require('../src/resources/langchain/langchain.service');
    const { RedisRateLimitService } = require('../src/common/rate-limit/redis-rate-limit.service');
    const { MetricasController } = require('../src/resources/metricas/metricas.controller');
    const { MetricasService } = require('../src/resources/metricas/metricas.service');
    const { PesquisadoresController } = require('../src/resources/pesquisadores/pesquisadores.controller');
    const { PesquisadoresService } = require('../src/resources/pesquisadores/pesquisadores.service');
    const { GruposPesquisaController } = require('../src/resources/grupos-pesquisa/grupos-pesquisa.controller');
    const { GruposPesquisaService } = require('../src/resources/grupos-pesquisa/grupos-pesquisa.service');
    const { buildSemanticFilterConditions } = require('../../langchain-ts/src/services/semanticFilters');
    const { buildProductionSearchWhere } = require('../src/resources/producoes/search/full-text-search');
    let aiCalls = 0;
    const semanticCalls = [];
    const module = await Test.createTestingModule({
      controllers: [ProducoesController, MetricasController, PesquisadoresController, GruposPesquisaController],
      providers: [ProducoesService, MetricasService, PesquisadoresService, GruposPesquisaService,
        { provide: PrismaService, useValue: prisma },
        { provide: LangchainGatewayService, useValue: { semanticSearch: (...args) => {
          semanticCalls.push(args);
          return Promise.resolve({ results: [], totalItems: 0 });
        } } },
        { provide: CACHE_MANAGER, useValue: { wrap: (_key, callback) => callback() } },
        { provide: JwtService, useValue: {} },
        { provide: RedisRateLimitService, useValue: { consume: () => {
          aiCalls++;
          return Promise.resolve({ allowed: true, limit: 2, remaining: 0, retryAfterMs: 60_000 });
        } } },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    const request = require('supertest')(app.getHttpServer());
    const ids = Array.from({ length: 8 }, () => randomUUID());
    const authors = [randomUUID(), randomUUID()];
    const groups = [randomUUID(), randomUUID()];
    const titles = ['Física de plasma', 'Química aplicada', 'Física', 'Banco de', 'Bioinformática', 'Physical plasma modeling', 'e-mail em C++'];
    const abstracts = ['Banco de dados e computação aplicada', 'Aplicações da física de plasma', 'Plasma e computacao', 'dados distribuídos', null, 'Optical diagnostics', 'COVID-19 e SARS-CoV-2'];
    await prisma.producao.createMany({ data: titles.map((titulo, index) => ({
      id: ids[index], titulo, resumo: abstracts[index], ano: index === 1 ? 2023 : 2024,
      tipo: index === 1 ? 'LIVROCAPITULO' : 'ARTIGO', qualis: index === 0 ? 'A1' : null,
      issn: index === 0 ? '1234-567X' : null, criadoEm: new Date('2026-10-28T12:00:00Z'),
    })) });
    const researcherIds = [...authors, ...Array.from({ length: 7 }, () => randomUUID())];
    const researcherNames = ['Carlos Alvares Fernando', 'Carlos Lima', 'Fernando Alvares',
      'Cárlos Álvares Fernándo', 'Fernando Carlos', 'Carlos Fernandes', "Carlos D'Ávila Fernando",
      'Carlos % Fernando', 'Carlos _ Fernando'];
    await prisma.pesquisador.createMany({ data: researcherIds.map((id, i) => ({
      id, nome: researcherNames[i], tipo: i === 3 ? 'ESTUDANTE' : i === 4 ? 'TECNICO' : i === 7 ? 'COLABORADOR_ESTRANGEIRO' : 'PESQUISADOR',
      formacaoAcademica: i === 0 ? 'DOUTORADO' : i === 6 ? 'MESTRADO' : null,
      lattesId: i === 0 ? '0000000000000001' : null, orcidId: i === 0 ? '0000-0000-0000-0001' : null,
      indexH: i, indexI10: i * 2,
    })) });
    await prisma.grupoPesquisa.createMany({ data: groups.map(id => ({ id, nome: 'Grupo sintético', areaPredominante: 'Física', situacao: 'CERTIFICADO' })) });
    await prisma.membroGrupo.createMany({ data: authors.map((pesquisadorId, i) => ({ pesquisadorId, grupoId: groups[i] })) });
    await prisma.membroGrupo.createMany({ data: [
      { pesquisadorId: researcherIds[3], grupoId: groups[0], eLider: false },
      { pesquisadorId: researcherIds[6], grupoId: groups[0], eLider: true },
      { pesquisadorId: researcherIds[6], grupoId: groups[1], eLider: false },
    ] });
    await prisma.producaoPesquisador.createMany({ data: [
      { producaoId: ids[0], pesquisadorId: authors[0] }, { producaoId: ids[0], pesquisadorId: authors[1] },
      { producaoId: ids[2], pesquisadorId: authors[1] },
    ] });
    const search = async (q, extra = {}) => {
      const response = await request.get('/producoes').query({ q, ...extra });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return response.body;
    };
    const expectIds = async (q, expected, extra) => {
      const result = await search(q, extra);
      assert.deepEqual(result.data.map(item => item.id).sort(), expected.map(i => ids[i]).sort(), q);
      assert.equal(result.meta.totalItems, expected.length, q);
      assert(!JSON.stringify(result).includes('criadoEm'));
      assert(!JSON.stringify(result).includes('buscaTextual'));
      assert(!JSON.stringify(result).includes('busca_textual'));
    };
    await expectIds('fisica AND plasma', [0, 1, 2]);
    await expectIds('fisica plasma', [0, 1, 2]);
    await expectIds('plasma fisica', [0, 1, 2]);
    await expectIds('fisica de plasma', [0, 1]); // Registro 1 contém os termos somente no resumo.
    await expectIds('computacao', [0, 2]); // Ambos contêm o termo somente no resumo.
    await expectIds('(fisica OR quimica) AND plasma', [0, 1, 2]);
    await expectIds('fisica AND NOT computacao', [1]);
    await expectIds('"banco de dados"', [0]); // Não deve casar com título+resumo do registro 3.
    await expectIds('banco AND NOT "banco de dados"', [3]);
    await expectIds('FÍSICA plasma AND computacao', [0, 2]);
    await expectIds('physical AND plasma', [5]);
    await expectIds('"e-mail" AND "C++"', [6]);
    await expectIds('inexistente123', []);
    await expectIds('fisica OR fisica', [0], { ano: 2024, tipo: 'ARTIGO', qualis: 'A1', issn: '1234567X' });
    await expectIds('fisica OR fisica', [0], { pesquisadorId: authors[0] });
    await expectIds('fisica OR fisica', [0, 2], { grupoId: groups[1] });
    await expectIds('fisica OR fisica', [], { pesquisadorId: authors[0], grupoId: groups[1] });
    await expectIds('fisica OR fisica', [1], { titulo: 'QUIMICA' });
    await expectIds('fisica', [1], { titulo: 'aplicacoes' }); // O segundo filtro também encontra o resumo.
    const legacy = await request.get('/producoes').query({ titulo: 'fisica AND plasma' });
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.meta.totalItems, 3);
    const legacyPlain = await request.get('/producoes').query({ titulo: 'fisica de plasma' });
    assert.equal(legacyPlain.status, 200);
    assert.deepEqual(legacyPlain.body.data.map(item => item.id).sort(), [ids[0], ids[1]].sort());
    await expectIds('fisica AND plasma', [0, 1, 2], { modoBusca: 'textual' });
    const nested = await request.get(`/pesquisadores/${authors[0]}/producoes`).query({ titulo: 'fisica AND plasma' });
    assert.equal(nested.status, 200);
    assert.deepEqual(nested.body.data.map(item => item.id), [ids[0]]);
    const nestedPlain = await request.get(`/pesquisadores/${authors[0]}/producoes`).query({ q: 'computacao' });
    assert.equal(nestedPlain.status, 200);
    assert.deepEqual(nestedPlain.body.data.map(item => item.id), [ids[0]], 'A busca do pesquisador também encontra termos no resumo.');
    const all = await search('fisica OR fisica', { ordenarPor: 'ano', ordem: 'desc' });
    const pages = [];
    for (let page = 1; page <= 3; page++) {
      const result = await search('fisica OR fisica', { ordenarPor: 'ano', ordem: 'desc', size: 1, page });
      assert.deepEqual(result.meta, { page, size: 1, totalItems: 3, totalPages: 3 });
      pages.push(result.data[0].id);
    }
    assert.deepEqual(pages, all.data.map(item => item.id));
    const plainUnlimited = await search('fisica', { size: 0 });
    assert.deepEqual(plainUnlimited.meta, { page: 1, size: 0, totalItems: 3, totalPages: 1 });
    assert.equal((await search('fisica', { size: 200 })).data.length, 3);

    const findNames = async (query, expected) => {
      const response = await request.get('/pesquisadores').query(query);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.deepEqual(response.body.data.map(item => item.id).sort(), expected.map(i => researcherIds[i]).sort());
      assert.equal(response.body.meta.totalItems, expected.length);
      assert(!JSON.stringify(response.body).includes('criadoEm'));
      return response.body;
    };
    const matchingNames = [0, 3, 4, 6, 7, 8];
    const allNames = await findNames({ nome: 'Carlos Fernando' }, matchingNames);
    await findNames({ nome: 'FERNÁNDO  CÁRLOS carlos' }, matchingNames);
    await findNames({ q: 'Carlos Fernando' }, matchingNames);
    await findNames({ q: 'Carlos Fernando', modoBusca: 'textual' }, matchingNames);
    await findNames({ nome: 'Carl Fer' }, [0, 3, 4, 5, 6, 7, 8]);
    await findNames({ nome: "D'Avila Fernando" }, [6]);
    await findNames({ nome: 'Carlos % Fernando' }, [7]);
    await findNames({ nome: 'Carlos _ Fernando' }, [8]);
    await findNames({ nome: 'Carlos Ausente' }, []);
    await findNames({ nome: '   ' }, []);
    await findNames({ nome: 'Carlos Fernando', tipo: 'ESTUDANTE' }, [3]);
    await findNames({ nome: 'Carlos Fernando', tipo: 'COLABORADOR_ESTRANGEIRO' }, [7]);
    await findNames({ nome: 'Carlos Fernando', formacaoAcademica: 'DOUTORADO' }, [0]);
    await findNames({ nome: 'Carlos Fernando', lattesId: '0000000000000001', orcidId: '0000-0000-0000-0001' }, [0]);
    await findNames({ nome: 'Carlos Fernando', grupoPesquisaId: groups[0], eLider: false }, [0, 3]);
    await findNames({ nome: 'Carlos Fernando', grupoPesquisaId: groups[0], eLider: true }, [6]);
    await findNames({ nome: 'Carlos Fernando', size: 0 }, matchingNames);
    const namePages = [];
    for (let page = 1; page <= 3; page++) {
      const response = await request.get('/pesquisadores').query({ nome: 'Carlos Fernando', page, size: 2 });
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.meta, { page, size: 2, totalItems: 6, totalPages: 3 });
      namePages.push(...response.body.data.map(item => item.id));
    }
    assert.deepEqual(namePages, allNames.data.map(item => item.id));
    const byIndex = await findNames({ nome: 'Carlos Fernando', ordenarPor: 'indexH', ordem: 'desc' }, matchingNames);
    assert.equal(byIndex.data[0].id, researcherIds[8]);
    const groupNames = await request.get(`/grupos-pesquisa/${groups[0]}/pesquisadores`).query({ nome: 'Carlos Fernando' });
    assert.equal(groupNames.status, 200, JSON.stringify(groupNames.body));
    assert.deepEqual(groupNames.body.data.map(item => item.id).sort(), [0, 3, 6].map(i => researcherIds[i]).sort());
    const semanticNames = async (nome, expected) => {
      const parameters = [];
      const conditions = buildSemanticFilterConditions('PESQUISADOR', { nome }, value => {
        parameters.push(value);
        return `$${parameters.length}`;
      });
      const rows = await prisma.$queryRawUnsafe(`SELECT p.id FROM public.pesquisador p WHERE ${conditions.join(' AND ')}`, ...parameters);
      assert.deepEqual(rows.map(item => item.id).sort(), expected.map(i => researcherIds[i]).sort());
    };
    await semanticNames('Carlos Fernando', matchingNames);
    await semanticNames('Carlos % Fernando', [7]);
    await findNames({ nome: "Carlos'); DROP TABLE pesquisador; --" }, []);
    assert.equal(await prisma.pesquisador.count(), 9);
    console.log('PASS: nome com termos separados, ordem inversa, acentos, parciais, curingas literais, filtros, liderança no grupo, paginação e filtro semântico no PostgreSQL.');
    for (const query of [{ q: 'fisica AND' }, { q: 'NOT fisica' }, { q: 'fisica OR NOT plasma' },
      { q: '"' }, { q: '' }, { q: 'fisica AND plasma', size: 0 }, { q: 'fisica AND plasma', size: 101 }, { q: 'fisica', page: 0 }]) {
      assert.equal((await request.get('/producoes').query(query)).status, 400);
    }
    await expectIds('"x\'); DROP TABLE producao; --"', []);
    assert.equal(await prisma.producao.count(), 7);
    assert.equal(aiCalls, 0, 'Busca booleana chamou o limitador de IA.');
    assert.equal(semanticCalls.length, 0, 'Busca booleana chamou o serviço de IA.');
    await prisma.producao.update({ where: { id: ids[4] }, data: { titulo: 'Bioinformática termonovo', resumo: 'resumonovo' } });
    await expectIds('termonovo AND bioinformatica', [4]);
    await expectIds('"resumonovo"', [4]);
    console.log('PASS: HTTP, operadores, frases por campo, acentos, idiomas, filtros, autores, paginação, erros, SQL parametrizado e atualização automática do GIN.');

    const textual = await request.get('/producoes').query({ q: 'FÍSICA' });
    assert.equal(textual.status, 200);
    assert.deepEqual(textual.body.data.map(item => item.id).sort(), [ids[0], ids[1], ids[2]].sort());
    const semantic = await request.get('/producoes').query({ q: 'plasma AND fisica', modoBusca: 'semantica' });
    const alias = await request.get('/producoes/busca-semantica').query({ q: 'plasma AND fisica' });
    assert.equal(semantic.status, 200);
    assert.equal(alias.status, 200);
    assert.deepEqual(semantic.body, alias.body);
    assert.deepEqual(semanticCalls[0], semanticCalls[1]);
    assert.equal(aiCalls, 2);
    console.log('PASS: busca padrão encontra título/resumo sem operadores, parâmetros legados e listagem do pesquisador; alias semântico mantém serviço/contrato (IA simulada).');

    const daily = async extra => {
      const response = await request.get('/metricas/diarias').query(extra ?? {});
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return response.body.producoes;
    };
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_metricas_sistema');
    assert.equal((await daily()).at(-1).totalAcumulado, 7);
    assert.equal((await daily({ entidade: 'producoes' })).at(-1).totalAcumulado, 7);
    await prisma.producao.create({ data: { id: ids[7], titulo: 'Nova produção', criadoEm: new Date('2026-10-29T12:00:00Z') } });
    assert.equal((await daily()).at(-1).totalAcumulado, 7, 'View deve continuar como snapshot até o refresh.');
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_metricas_sistema');
    assert.equal((await daily()).at(-1).totalAcumulado, 8);
    assert.deepEqual(await daily({ entidade: 'producoes', dataInicio: '2026-10-29', dataFim: '2026-10-29' }),
      [{ dataRegistro: '29-10-2026', novosNoDia: 1, totalAcumulado: 8 }]);
    console.log('PASS: view armazena produções; API retorna total, filtro e datas; refresh concorrente atualiza os números.');

    await prisma.$executeRawUnsafe(`INSERT INTO public.producao (id,titulo,resumo,tipo,criado_em,atualizado_em)
      SELECT 'volume-'||n, 'Produção sintética de volume '||n, 'Estudo genérico sem os termos específicos da busca', 'artigo', now(), now()
      FROM generate_series(1,30000) n`);
    await prisma.$executeRawUnsafe('ANALYZE public.producao');
    const where = buildProductionSearchWhere({ q: 'bioinformatica', page: 1, size: 30 });
    const explain = async () => (await prisma.$queryRaw(Prisma.sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT p.id FROM public.producao p WHERE ${where}
    `))[0]['QUERY PLAN'][0];
    await prisma.$executeRawUnsafe('DROP INDEX public.producao_busca_booleana_gin_idx');
    const before = await explain();
    // Exercita a inclusão da coluna gerada em tabela já populada, preservando as fontes.
    const original = await prisma.producao.findUnique({ where: { id: ids[0] } });
    await prisma.$executeRawUnsafe('ALTER TABLE public.producao DROP COLUMN busca_textual');
    await prisma.$executeRawUnsafe(fs.readFileSync(path.join(root,
      'shared/database/prisma/migrations/20261029120030_producao_busca_vetor/migration.sql'), 'utf8'));
    assert.equal(await prisma.producao.count(), 30008);
    assert.deepEqual(await prisma.producao.findUnique({ where: { id: ids[0] } }), original);
    const [generated] = await prisma.$queryRaw`SELECT is_generated FROM information_schema.columns
      WHERE table_schema='public' AND table_name='producao' AND column_name='busca_textual'`;
    assert.equal(generated.is_generated, 'ALWAYS');
    const [filled] = await prisma.$queryRaw`SELECT count(*)::int AS total FROM public.producao WHERE busca_textual IS NOT NULL`;
    assert.equal(filled.total, 30008);
    await prisma.$executeRawUnsafe(fs.readFileSync(path.join(root,
      'shared/database/prisma/migrations/20261029120100_producao_busca_gin/migration.sql'), 'utf8'));
    const after = await explain();
    assert(JSON.stringify(after.Plan).includes('producao_busca_booleana_gin_idx'), 'Plano real não usou GIN.');
    const [index] = await prisma.$queryRaw`SELECT pg_size_pretty(pg_relation_size('public.producao_busca_booleana_gin_idx')) AS tamanho`;
    console.log(JSON.stringify({ linhas: 30008, semGinMs: before['Execution Time'], comGinMs: after['Execution Time'], tamanhoGin: index.tamanho }));
    console.log('PASS: plano real usa índice GIN sem forçar enable_seqscan.');
  } finally {
    try {
      await Promise.all([app?.close(), prisma?.$disconnect()]);
    } finally {
      if (started) docker('rm', '-f', container);
    }
  }
}

main().catch(error => {
  console.error(String(error.stack ?? error).replaceAll(password, '[redigido]'));
  process.exitCode = 1;
});
