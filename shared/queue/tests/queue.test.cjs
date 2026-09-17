const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  createQueueConnection, discoveryJobId, validateDiscoverDgpGroupsJob,
  validateScrapeDgpGroupJob, validateScrapeLattesResearcherJob,
  etlGroupJobId, etlResearcherJobId, parseDataScope, validateEtlGroupJob, validateEtlResearcherJob,
} = require('../dist');

test('le REDIS_URL para produtor e limita tentativas de conexao', () => {
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://usuario:senha@redis.local:6380/2';
  try {
    const connection = createQueueConnection('producer');
    assert.deepEqual(connection, {
      host: 'redis.local', port: 6380, username: 'usuario', password: 'senha',
      db: 2, maxRetriesPerRequest: 1, connectTimeout: 1500,
      retryStrategy: connection.retryStrategy,
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
  assert.doesNotThrow(() => validateScrapeDgpGroupJob({ ...data, scope: 'simcc' }));
  assert.throws(() => validateScrapeDgpGroupJob({ ...data, scope: 'outro' }), /escopo/);
  assert.throws(() => validateScrapeDgpGroupJob({ dgpId: '123', requestedAt: new Date().toISOString() }), /16 digitos/);
  assert.throws(() => validateScrapeDgpGroupJob({ ...data, dgpId: 1234567890123456 }), /16 digitos/);
  assert.throws(() => validateScrapeDgpGroupJob({ ...data, pipelineLogId: null }), /pipeline/);
  assert.throws(() => validateScrapeDgpGroupJob({ ...data, version: 2 }), /versao/);
  assert.throws(() => validateScrapeDgpGroupJob(null), /16 digitos/);
});

test('normaliza apenas os escopos de dados suportados', () => {
  assert.equal(parseDataScope('default'), 'default');
  assert.equal(parseDataScope('simcc'), 'simcc');
  assert.throws(() => parseDataScope('outro'), /default ou --scope simcc/);
});

test('valida pesquisador Lattes e chave de descoberta', () => {
  const manifest = {
    version: 1, requestedAt: new Date().toISOString(),
    pipelineLogId: '12345678-1234-1234-1234-123456789012',
    pipelineItemId: '12345678-1234-1234-1234-123456789013',
  };
  assert.doesNotThrow(() => validateScrapeLattesResearcherJob({
    ...manifest, lattesId: '0000000000000001', nome: 'Pesquisador',
  }));
  assert.throws(() => validateScrapeLattesResearcherJob({ ...manifest, lattesId: '1', nome: 'Pesquisador' }), /16 digitos/);
  assert.throws(() => validateScrapeLattesResearcherJob({ ...manifest, lattesId: '0000000000000001', nome: '' }), /obrigatorio/);
  assert.doesNotThrow(() => validateDiscoverDgpGroupsJob({ ...manifest, chave: 'Ciência da Computação' }));
  assert.throws(() => validateDiscoverDgpGroupsJob({ ...manifest, chave: '' }), /entre 1 e 100/);
  assert.equal(discoveryJobId(' Computação '), discoveryJobId('computação'));
});

test('valida manifestos de arquivos ETL e gera IDs determinísticos', () => {
  const manifest = {
    version: 1, requestedAt: new Date().toISOString(),
    pipelineLogId: '12345678-1234-1234-1234-123456789012',
    pipelineItemId: '12345678-1234-1234-1234-123456789013',
    arquivoJson: '0000000000000001.json', tamanhoBytes: 42, hashArquivo: 'a'.repeat(64),
  };
  assert.doesNotThrow(() => validateEtlGroupJob({ ...manifest, dgpId: '0000000000000001' }));
  assert.doesNotThrow(() => validateEtlGroupJob({ ...manifest, dgpId: '0000000000000001', scope: 'simcc' }));
  assert.throws(() => validateEtlGroupJob({ ...manifest, dgpId: '0000000000000001', scope: 'outro' }), /escopo/);
  assert.doesNotThrow(() => validateEtlResearcherJob({ ...manifest, lattesId: '0000000000000001' }));
  assert.throws(() => validateEtlGroupJob({ ...manifest, dgpId: '1' }), /16 digitos/);
  assert.throws(() => validateEtlResearcherJob({ ...manifest, lattesId: '0000000000000001', arquivoJson: '../x.json' }), /nome de um arquivo/);
  assert.throws(() => validateEtlGroupJob({ ...manifest, dgpId: '0000000000000001', hashArquivo: 'curto' }), /SHA-256/);
  assert.equal(etlGroupJobId('0000000000000001'), 'etl-grupo-0000000000000001');
  assert.equal(etlResearcherJobId('0000000000000001'), 'etl-pesquisador-0000000000000001');
});
