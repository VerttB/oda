const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createQueueConnection, validateScrapeDgpGroupJob } = require('../dist');

test('le REDIS_URL para produtor e limita tentativas de conexao', () => {
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://usuario:senha@redis.local:6380/2';
  try {
    assert.deepEqual(createQueueConnection('producer'), {
      host: 'redis.local', port: 6380, username: 'usuario', password: 'senha',
      db: 2, maxRetriesPerRequest: 1,
    });
  } finally {
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});

test('worker permanece aguardando o retorno do Redis', () => {
  const connection = createQueueConnection('worker');
  assert.equal(connection.maxRetriesPerRequest, null);
});

test('aceita apenas id DGP de 16 digitos', () => {
  const data = { version: 1, pipelineLogId: '12345678-1234-1234-1234-123456789012',
    pipelineItemId: '12345678-1234-1234-1234-123456789013', dgpId: '0000000000000001', requestedAt: new Date().toISOString() };
  assert.doesNotThrow(() => validateScrapeDgpGroupJob(data));
  assert.throws(() => validateScrapeDgpGroupJob({ dgpId: '123', requestedAt: new Date().toISOString() }), /16 digitos/);
  assert.throws(() => validateScrapeDgpGroupJob({ ...data, dgpId: 1234567890123456 }), /16 digitos/);
  assert.throws(() => validateScrapeDgpGroupJob({ ...data, pipelineLogId: null }), /pipeline/);
  assert.throws(() => validateScrapeDgpGroupJob({ ...data, version: 2 }), /versao/);
  assert.throws(() => validateScrapeDgpGroupJob(null), /16 digitos/);
});
