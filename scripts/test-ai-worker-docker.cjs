// Smoke test das imagens locais. Usa Redis descartável e não publica jobs de IA.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const suffix = `${process.pid}-${randomBytes(4).toString('hex')}`;
const redis = `oda-ai-smoke-redis-${suffix}`;
const worker = `oda-ai-smoke-worker-${suffix}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let redisStarted = false, workerStarted = false;

async function main() {
  try {
    docker('run', '--rm', '-d', '--name', redis, 'redis:7-alpine', '--save', '', '--appendonly', 'no');
    redisStarted = true;
    for (let attempt = 0; ; attempt++) {
      try { assert.equal(docker('exec', redis, 'redis-cli', 'ping'), 'PONG'); break; }
      catch (error) { if (attempt > 30) throw error; await pause(100); }
    }
    docker('run', '--rm', '-d', '--name', worker, '--network', `container:${redis}`,
      '-e', 'REDIS_URL=redis://127.0.0.1:6379',
      '-e', 'OPEN_AI_KEY=chave-ficticia-sem-chamadas',
      '-e', 'DATABASE_URL=postgresql://teste:teste@127.0.0.1:9/nao_utilizado',
      'oda-langchain:local', 'node', 'dist/queue/aiWorker.js');
    workerStarted = true;
    const probe = "const {createAiQueue}=require('@oda/queue');(async()=>{const q=createAiQueue();q.on('error',()=>{});try{await q.waitUntilReady();const workers=await q.getWorkers();if(!workers.length)throw Error('worker ausente');console.log('WORKER_READY')}finally{await q.close()}})().catch(error=>{console.error(error.message);process.exitCode=1})";
    let ready = false;
    let lastProbeError;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        ready = docker('exec', worker, 'node', '-e', probe).includes('WORKER_READY');
        if (ready) break;
      } catch (error) { lastProbeError = error.stderr?.toString() || error.message; }
      await pause(200);
    }
    if (!ready) {
      console.error(docker('logs', worker));
      console.error(lastProbeError);
      throw new Error('A imagem do worker não ficou pronta.');
    }
    assert.equal(docker('exec', redis, 'redis-cli', '--raw', 'LLEN', 'bull:oda-ai:wait'), '0');
    assert.equal(docker('exec', redis, 'redis-cli', '--raw', 'HGET', 'bull:oda-ai:meta', 'concurrency'), '1');
    console.log('PASS: imagem do worker inicia, configura concorrência global e conecta à fila sem publicar consultas.');
    const result = docker('run', '--rm', '--network', 'none', '--entrypoint', 'node', 'oda-api', '-e',
      "require('./dist/src/resources/langchain/langchain.module.js'); const {createAiQueue}=require('@oda/queue'); (async()=>{const q=createAiQueue();q.on('error',()=>{});try{if(q.opts.prefix!=='bull')throw Error('prefixo divergente'); console.log('API_MODULE_READY')}finally{await q.close()}})().catch(error=>{console.error(error.message);process.exitCode=1})");
    assert.ok(result.includes('API_MODULE_READY'));
    console.log('PASS: imagem da API carrega o módulo e as dependências BullMQ sem rede.');
  } finally {
    if (workerStarted) docker('stop', '-t', '5', worker);
    if (redisStarted) docker('stop', '-t', '1', redis);
  }
}

main().then(() => console.log('PASS: smoke test Docker concluído; containers temporários removidos.')).catch(error => { console.error(error); process.exitCode = 1; });
