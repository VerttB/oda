const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { Reflector } = require('@nestjs/core');
const { ZodSerializerInterceptor, ZodValidationPipe } = require('nestjs-zod');
const request = require('supertest');
const { configureApiVersioning } = require('../dist/src/common/api-versioning');
const { JwtAuthGuard } = require('../dist/src/common/auth/jwt-auth.guard');
const { JwtStrategy } = require('../dist/src/resources/auth/jwt.strategy');
const { PrismaService } = require('../dist/src/prisma/prisma.service');
const {
  ProducoesGrupoService,
} = require('../dist/src/resources/grupos-pesquisa/producoes-grupo.service');
const {
  ProducoesConfirmadasController,
  RevisaoProducoesGrupoController,
} = require('../dist/src/resources/grupos-pesquisa/producoes-grupo.controller');

async function testProductionGroup(db, productionId) {
  const secret = randomBytes(32).toString('hex');
  const jwt = new JwtService({ secret });
  const token = jwt.sign({
    sub: 'teste-id',
    role: 'ADMIN',
    username: 'revisor-teste',
  });
  const group = await db.grupoPesquisa.create({
    data: {
      nome: 'Grupo de teste isolado',
      situacao: 'CERTIFICADO',
      areaPredominante: 'Computação',
    },
  });
  const module = await Test.createTestingModule({
    controllers: [
      ProducoesConfirmadasController,
      RevisaoProducoesGrupoController,
    ],
    providers: [
      JwtStrategy,
      ProducoesGrupoService,
      {
        provide: ConfigService,
        useValue: new ConfigService({ JWT_SECRET: secret }),
      },
      { provide: PrismaService, useValue: db },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  try {
    configureApiVersioning(app);
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalInterceptors(new ZodSerializerInterceptor(app.get(Reflector)));
    await app.init();
    const http = request(app.getHttpServer());
    const listing =
      '/v1/grupos-pesquisa/' + group.id + '/producoes-confirmadas';
    const review =
      '/v1/admin/grupos-pesquisa/' +
      group.id +
      '/producoes/' +
      productionId +
      '/revisao';
    const admin = (method) =>
      http[method](review).auth(token, { type: 'bearer' });
    const decision = {
      decisao: 'CONFIRMADO',
      justificativa: 'Registro do projeto identifica a produção do grupo.',
      evidencia:
        'Documento de teste aponta o grupo como responsável pela produção.',
      fonteUrl: 'https://example.invalid/publicacao',
    };
    await http.get(review).set('X-SIMCC-Key', 'chave-simulada').expect(401);
    await http.put(review).send(decision).expect(401);
    await http
      .get(listing)
      .expect(200, {
        data: [],
        meta: { page: 1, size: 30, totalItems: 0, totalPages: 0 },
      });
    await admin('get').expect(200, { versao: 0, revisao: null });
    await admin('put')
      .send({ ...decision, versaoEsperada: 0, evidencia: null })
      .expect(400);
    await admin('put')
      .send({ ...decision, versaoEsperada: 0, revisor: 'outro' })
      .expect(400);
    await admin('put')
      .send({
        decisao: 'INCONCLUSIVO',
        justificativa: 'A fonte institucional ainda não foi localizada.',
        versaoEsperada: 0,
      })
      .expect(200);
    await http
      .get(listing)
      .expect(200, {
        data: [],
        meta: { page: 1, size: 30, totalItems: 0, totalPages: 0 },
      });
    const { body: confirmed } = await admin('put')
      .send({ ...decision, versaoEsperada: 1 })
      .expect(200);
    assert.equal(confirmed.versao, 2);
    assert.equal(confirmed.revisao.revisor, 'revisor-teste');
    await admin('put')
      .send({ ...decision, versaoEsperada: 1 })
      .expect(200, confirmed);
    const { body: published } = await http.get(listing + '?size=1').expect(200);
    assert.equal(published.meta.totalItems, 1);
    assert.equal(published.data[0].id, productionId);
    assert.deepEqual(Object.keys(published.data[0]).sort(), [
      'ano',
      'doi',
      'id',
      'tipo',
      'titulo',
      'url',
    ]);
    await http
      .get(listing + '?page=2&size=1')
      .expect(200, {
        data: [],
        meta: { page: 2, size: 1, totalItems: 1, totalPages: 1 },
      });
    await http.get(listing + '?size=101').expect(400);
    const history = [
      {
        decisao: 'REJEITADO',
        justificativa: 'A documentação atribui a obra a outra unidade.',
        versaoEsperada: 2,
      },
      {
        decisao: 'INCONCLUSIVO',
        justificativa: 'A evidência anterior precisa de nova revisão.',
        versaoEsperada: 2,
      },
    ];
    // Revisores concorrentes partem da mesma versão. Somente um pode avançar.
    const replies = await Promise.all(
      history.map((input) => admin('put').send(input)),
    );
    assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 409]);
    const stored = await db.producaoGrupoRevisao.findMany({
      where: { grupoId: group.id, producaoId: productionId },
      orderBy: { versao: 'asc' },
    });
    assert.equal(stored.length, 3);
    assert.equal(stored[1].decisao, 'CONFIRMADO');
    await http
      .get(listing)
      .expect(200, {
        data: [],
        meta: { page: 1, size: 30, totalItems: 0, totalPages: 0 },
      });
  } finally {
    await app.close();
  }
  return group.id;
}

module.exports = { testProductionGroup };
