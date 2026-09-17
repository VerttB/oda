const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { Queue, QueueEvents, Worker } = require('bullmq');
const { createQueueConnection } = require('../dist/connection');

test('Redis local: publicar, repetir uma falha e confirmar o resultado', { timeout: 20_000 }, async () => {
  const connection = createQueueConnection('producer');
  assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(connection.host),
    'Este teste so pode usar Redis local; confira REDIS_URL.');
  // Diferentemente do worker real, o teste deve falhar rapido sem infraestrutura.
  const testConnection = role => ({
    ...createQueueConnection(role), connectTimeout: 3_000, retryStrategy: () => null,
  });

  // A fila exclusiva permite limpar somente os dados criados por este teste.
  const name = `oda-redis-test-${randomUUID()}`;
  const queue = new Queue(name, { connection: testConnection('producer') });
  const events = new QueueEvents(name, { connection: testConnection('worker') });
  const infrastructureErrors = [];
  queue.on('error', error => infrastructureErrors.push(error));
  events.on('error', error => infrastructureErrors.push(error));
  let worker;
  try {
    await events.waitUntilReady();
    assert.equal(await (await queue.client).ping(), 'PONG');
    const job = await queue.add('smoke', { simulated: true }, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 100 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    assert.equal(await job.getState(), 'waiting');

    worker = new Worker(name, async current => {
      if (current.attemptsMade === 0) throw new Error('Falha simulada para testar a retentativa');
      await current.updateProgress(100);
      return { simulated: current.data.simulated };
    }, { connection: testConnection('worker'), concurrency: 1 });
    worker.on('error', error => infrastructureErrors.push(error));

    assert.deepEqual(await job.waitUntilFinished(events, 10_000), { simulated: true });
    const stored = await queue.getJob(job.id);
    assert.equal(await stored.getState(), 'completed');
    assert.equal(stored.attemptsMade, 2);
    assert.equal(stored.progress, 100);
    assert.deepEqual(infrastructureErrors, []);
  } finally {
    if (worker) await worker.close();
    try {
      await queue.obliterate();
    } finally {
      await events.close();
      await queue.close();
    }
  }
});
