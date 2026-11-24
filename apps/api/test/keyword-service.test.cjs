const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  PalavraChaveService,
} = require('../dist/src/resources/palavra-chave/palavra-chave.service');

function fixture(current = { origem: 'MANUAL', externalId: null }) {
  const events = [];
  const prisma = {
    palavraChave: {
      async findUnique() {
        return current;
      },
      async create({ data }) {
        events.push('write');
        return data;
      },
      async update({ data }) {
        events.push('write');
        return data;
      },
    },
  };
  const service = new PalavraChaveService(prisma, {
    async del() {
      events.push('invalidate');
    },
  });
  return { service, prisma, events };
}

test('cadastro manual conserva símbolos e invalida cache após persistir', async () => {
  const { service, events } = fixture();
  const saved = await service.create({ termo: '  C++  ' });
  assert.deepEqual(saved, {
    termo: 'C++',
    termoNormalizado: 'c++',
    origem: 'MANUAL',
    chaveIdentidade: 'c++',
  });
  assert.deepEqual(events, ['write', 'invalidate']);
});

test('renomear termo manual atualiza sua identidade e a chave de busca', async () => {
  const { service } = fixture();
  assert.deepEqual(
    await service.update('id', { termo: ' Ciência de Dados ' }),
    {
      termo: 'Ciência de Dados',
      termoNormalizado: 'ciencia de dados',
      chaveIdentidade: 'ciência de dados',
    },
  );
});

test('edição de rótulo preserva identidade de fontes externas e do legado', async () => {
  for (const origem of ['OPENALEX', 'DGP', 'LEGADO_NAO_INFORMADO']) {
    const { service } = fixture({
      origem,
      externalId:
        origem === 'OPENALEX' ? 'https://openalex.org/keywords/data' : null,
    });
    const saved = await service.update('id', { termo: 'Dados' });
    assert.deepEqual(saved, { termo: 'Dados', termoNormalizado: 'dados' });
  }
});

test('termo vazio é recusado sem escrita nem invalidação', async () => {
  const { service, events } = fixture();
  await assert.rejects(
    service.create({ termo: '   ' }),
    (error) => error.getStatus() === 400,
  );
  await assert.rejects(
    service.update('id', { termo: null }),
    (error) => error.getStatus() === 400,
  );
  assert.deepEqual(events, []);
});

test('conflito de identidade retorna 409 e não invalida cache', async () => {
  const { service, prisma, events } = fixture();
  prisma.palavraChave.create = prisma.palavraChave.update = async () => {
    throw { code: 'P2002' };
  };
  await assert.rejects(
    service.create({ termo: 'C++' }),
    (error) => error.getStatus() === 409,
  );
  await assert.rejects(
    service.update('id', { termo: 'C++' }),
    (error) => error.getStatus() === 409,
  );
  assert.deepEqual(events, []);
});

test('termo inexistente retorna 404; campos alheios não são aceitos na escrita', async () => {
  const missing = fixture(null);
  await assert.rejects(
    missing.service.update('ausente', { termo: 'Dados' }),
    (error) => error.getStatus() === 404,
  );
  assert.deepEqual(missing.events, []);
  const { service } = fixture();
  const saved = await service.update('id', {
    termo: 'Dados',
    origem: 'OPENALEX',
    externalId: 'outro',
  });
  assert.equal(saved.origem, undefined);
  assert.equal(saved.externalId, undefined);
});
