const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { reconcileEtlQueues } = require('../dist/queue/etlDispatch');

function manifest() {
  return {
    version: 1,
    requestedAt: new Date().toISOString(),
    pipelineLogId: randomUUID(),
    pipelineItemId: randomUUID(),
    arquivoJson: '1234567890123456.json',
    tamanhoBytes: 100,
    hashArquivo: 'a'.repeat(64),
  };
}

function queue() {
  const jobs = new Map();
  return {
    added: [],
    async add(name, data, options) {
      const job = {
        id: options.jobId,
        name,
        data,
        attemptsMade: 0,
        async getState() { return 'waiting'; },
      };
      jobs.set(options.jobId, job);
      this.added.push(job);
      return job;
    },
    async getJob(id) { return jobs.get(id) || null; },
  };
}

test('publica pesquisadores apenas depois de todos os grupos terminarem', async () => {
  const base = manifest();
  const groupJob = { ...base, dgpId: '1234567890123456' };
  const researcherJob = {
    ...manifest(),
    pipelineLogId: base.pipelineLogId,
    lattesId: '1234567890123456',
  };
  const batch = {
    id: base.pipelineLogId,
    groupJobs: [groupJob],
    researcherJobs: [researcherJob],
    groupsPublished: false,
    researchersPublished: false,
  };
  const results = new Set();
  const repository = {
    async *openBatches() { yield batch; },
    async result(data) { return results.has(data.pipelineItemId) ? { status: 'SUCESSO' } : null; },
    async sealGroups(_batch, accepted) { batch.groupJobs = accepted; batch.groupsPublished = true; },
    async sealResearchers(_batch, accepted) { batch.researcherJobs = accepted; batch.researchersPublished = true; },
    async getOpenBatch() { return batch; },
    async groupsFinished() { return batch.groupJobs.every(job => results.has(job.pipelineItemId)); },
    async settle() {},
  };
  const groupQueue = queue();
  const researcherQueue = queue();

  await reconcileEtlQueues(groupQueue, researcherQueue, repository);
  assert.equal(groupQueue.added.length, 1);
  assert.equal(researcherQueue.added.length, 0);

  results.add(groupJob.pipelineItemId);
  await reconcileEtlQueues(groupQueue, researcherQueue, repository);
  assert.equal(groupQueue.added.length, 1);
  assert.equal(researcherQueue.added.length, 1);
  assert.equal(researcherQueue.added[0].data.pipelineItemId, researcherJob.pipelineItemId);
});
