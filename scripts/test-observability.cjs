// Teste com PostgreSQL e Redis descartáveis, URLs explícitas locais e sem volumes do projeto.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const req = createRequire(path.resolve(__dirname, "../apps/api/package.json"));
const { PrismaClient } = req("@oda/database");
const { PrismaPg } = req("@prisma/adapter-pg");
const { Queue, Worker } = req("bullmq");
const {
  beginPipelineItem,
  retainPipelineHistory,
  startSimccConsistency,
  finishSimccConsistency,
} = req("@oda/database");
const root = path.resolve(__dirname, "..");
const names = ["oda-obs-pg-" + process.pid, "oda-obs-redis-" + process.pid];
let db, queue, worker;
const started = [];
function docker(...args) {
  const r = spawnSync("docker", args, { encoding: "utf8", timeout: 60000 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || String(r.error));
  return r.stdout.trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) {
  for (let n = 0; n < 80; n++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await sleep(150);
  }
  throw new Error("Tempo de teste excedido");
}
async function main() {
  docker(
    "run",
    "--rm",
    "-d",
    "--name",
    names[0],
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "-p",
    "127.0.0.1::5432",
    "pgvector/pgvector:pg17",
  );
  started.push(names[0]);
  docker(
    "run",
    "--rm",
    "-d",
    "--name",
    names[1],
    "-p",
    "127.0.0.1::6379",
    "redis:7-alpine",
  );
  started.push(names[1]);
  const pgPort = Number(docker("port", names[0], "5432/tcp").split(":").pop());
  const redisPort = Number(
    docker("port", names[1], "6379/tcp").split(":").pop(),
  );
  const pg = new (req("pg").Client)({
    host: "127.0.0.1",
    port: pgPort,
    user: "postgres",
    database: "postgres",
  });
  await until(async () => {
    const r = spawnSync("docker", [
      "exec",
      names[0],
      "pg_isready",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
    ]);
    return r.status === 0;
  });
  await pg.connect();
  const migrations = path.join(root, "shared/database/prisma/migrations");
  for (const dir of readdirSync(migrations)
    .filter((f) => !f.includes("."))
    .sort()) {
    await pg.query(
      readFileSync(path.join(migrations, dir, "migration.sql"), "utf8"),
    );
  }
  console.log("PASS migration completa em banco vazio isolado");
  await pg.end();
  db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: `postgresql://postgres@127.0.0.1:${pgPort}/postgres`,
    }),
  });
  const pipeline = await db.pipelineLog.create({
    data: {
      modulo: "ETL",
      status: "CONCLUIDO",
      dataFim: new Date("2026-10-10"),
      metadata: { scope: "default" },
    },
  });
  const success = randomUUID(),
    failure = randomUUID();
  await beginPipelineItem(db, pipeline.id, success);
  await beginPipelineItem(db, pipeline.id, success);
  await db.pipelineLogItem.createMany({
    data: [
      {
        id: success,
        pipelineLogId: pipeline.id,
        entidadeId: "1",
        status: "SUCESSO",
        etapa: "ETL_PESQUISADOR_CARGA",
        tempoMs: 100,
      },
      {
        id: failure,
        pipelineLogId: pipeline.id,
        entidadeId: "2",
        status: "ERRO",
        etapa: "ETL_PESQUISADOR_CARGA",
        tempoMs: 200,
      },
    ],
  });
  const metrics = () =>
    db.$queryRawUnsafe(
      "SELECT SUM(sucessos)::int s,SUM(falhas)::int f,SUM(tentativas_adicionais)::int t FROM vw_metricas_pipeline_diarias",
    );
  assert.deepEqual((await metrics())[0], { s: 1, f: 1, t: 1 });
  const active = await db.pipelineLog.create({
    data: {
      modulo: "ETL",
      status: "EMANDAMENTO",
      dataInicio: new Date("2020-01-01"),
    },
  });
  assert.equal(await retainPipelineHistory(db, new Date()), 1);
  assert.deepEqual((await metrics())[0], { s: 1, f: 1, t: 1 });
  assert.equal(await retainPipelineHistory(db, new Date()), 0);
  assert.ok(await db.pipelineLog.findUnique({ where: { id: active.id } }));
  console.log(
    "PASS taxas, tentativas, retenção idempotente e preservação de execução ativa",
  );
  const batch = await db.pipelineLog.create({
    data: { modulo: "ETL", metadata: { scope: "simcc" } },
  });
  const dgpId = "1234567890123456";
  await startSimccConsistency(db, batch.id, [dgpId]);
  const institution = await db.instituicao.create({
    data: { nome: "Universidade do Estado da Bahia", sigla: "UNEB" },
  });
  const group = await db.grupoPesquisa.create({
    data: {
      dgpId,
      nome: "Grupo teste",
      areaPredominante: "Computação",
      situacao: "CERTIFICADO",
      instituicoes: {
        create: { instituicaoId: institution.id, tipoRelacao: "SEDE" },
      },
    },
  });
  await db.pipelineLog.update({
    where: { id: batch.id },
    data: { status: "CONCLUIDO", dataFim: new Date() },
  });
  await finishSimccConsistency(db, batch.id);
  let [report] =
    await db.$queryRaw`SELECT estado,resultado FROM relatorio_consistencia WHERE pipeline_log_id=${batch.id}`;
  assert.equal(report.estado, "CONCLUIDO");
  assert.ok(report.resultado.alertas.some((a) => a.regra === "SEM_MEMBROS"));
  await finishSimccConsistency(db, batch.id);
  const second = await db.pipelineLog.create({
    data: { modulo: "ETL", metadata: { scope: "simcc" } },
  });
  await startSimccConsistency(db, second.id, [dgpId]);
  await db.grupoPesquisaInstituicao.deleteMany({
    where: { grupoId: group.id },
  });
  await db.pipelineLog.update({
    where: { id: second.id },
    data: { status: "ERRO", dataFim: new Date() },
  });
  await finishSimccConsistency(db, second.id);
  [report] =
    await db.$queryRaw`SELECT estado,resultado FROM relatorio_consistencia WHERE pipeline_log_id=${second.id}`;
  assert.equal(report.estado, "PARCIAL");
  assert.ok(report.resultado.alertas.some((a) => a.regra === "FORA_SIMCC"));
  console.log("PASS snapshots SIMCC, falha parcial, sede perdida e reexecução");
  const { saveResearcherProductionsBatch } = require(
    path.join(root, "apps/etl/dist/lattes/productions.js"),
  );
  const authors = await Promise.all(
    ["Autor A", "Autor B"].map((nome) =>
      db.pesquisador.create({ data: { nome } }),
    ),
  );
  const production = {
    titulo: "Artigo compartilhado",
    ano: 2026,
    tipo: "ARTIGO",
    doi: null,
    url: null,
    veiculo: null,
    issn: null,
    qualis: null,
    resumo: null,
  };
  await Promise.all(
    authors.map((author) =>
      db.$transaction(
        (tx) => saveResearcherProductionsBatch(tx, author.id, [production]),
        { timeout: 15000 },
      ),
    ),
  );
  assert.equal(
    await db.producao.count({ where: { titulo: production.titulo } }),
    1,
  );
  assert.equal(await db.producaoPesquisador.count(), 2);
  console.log(
    "PASS concorrência real: dois autores, uma produção sem DOI e dois vínculos",
  );
  const connection = { host: "127.0.0.1", port: redisPort };
  queue = new Queue("oda-test-cleanup", { connection });
  worker = new Worker(queue.name, async () => ({ ok: true }), {
    connection: { ...connection, maxRetriesPerRequest: null },
  });
  const item = await db.pipelineLogItem.create({
    data: { pipelineLogId: active.id, status: "SUCESSO" },
  });
  await queue.add("test", { pipelineItemId: item.id }, { jobId: "terminal" });
  await until(async () => {
    const job = await queue.getJob("terminal");
    return job && (await job.getState()) === "completed";
  });
  const client = await queue.client;
  const old = Date.now() - 8 * 86400000;
  await client.hset(queue.toKey("terminal"), "finishedOn", old);
  await client.zadd(queue.toKey("completed"), old, "terminal");
  const { FilasCleanupService, REMOVE_TERMINAL_JOB } = require(
    path.join(
      root,
      "apps/api/dist/src/resources/filas/filas-cleanup.service.js",
    ),
  );
  const cleanup = new FilasCleanupService({ dgp: queue }, db);
  const input = {
    estado: "completed",
    maisAntigoQueHoras: 24,
    limite: 100,
    simular: true,
  };
  assert.equal((await cleanup.clean("dgp", input)).elegiveis, 1);
  assert.ok(await queue.getJob("terminal"));
  assert.equal(
    (await cleanup.clean("dgp", { ...input, simular: false })).removidos,
    1,
  );
  assert.equal(await queue.getJob("terminal"), undefined);
  await worker.close();
  worker = null;
  const waiting = await queue.add(
    "test",
    { pipelineItemId: item.id },
    { jobId: "waiting" },
  );
  const removed = await client.eval(
    REMOVE_TERMINAL_JOB,
    3,
    queue.toKey("completed"),
    queue.toKey("waiting"),
    queue.toKey("events"),
    "waiting",
    JSON.stringify(waiting.data),
    "completed",
  );
  assert.equal(removed, 0);
  assert.equal(await waiting.getState(), "waiting");
  console.log(
    "PASS limpeza simulada/real e proteção atômica de job pendente em Redis real",
  );
  const api = (file) => require(path.join(root, "apps/api/dist/src", file));
  const { Test } = req("@nestjs/testing");
  const { Reflector } = req("@nestjs/core");
  const { ConfigService } = req("@nestjs/config");
  const { JwtService } = req("@nestjs/jwt");
  const { ZodValidationPipe, ZodSerializerInterceptor } = req("nestjs-zod");
  const request = req("supertest");
  const { PipelineController } = api(
    "resources/observabilidade/pipeline.controller.js",
  );
  const { PipelineService } = api(
    "resources/observabilidade/pipeline.service.js",
  );
  const { LogsExportService } = api(
    "resources/observabilidade/logs-export.service.js",
  );
  const { ConsistencyController } = api(
    "resources/observabilidade/consistency.controller.js",
  );
  const { FilasStatusController } = api(
    "resources/filas/filas-status.controller.js",
  );
  const { FilasStatusService, FILAS_STATUS_QUEUES } = api(
    "resources/filas/filas-status.service.js",
  );
  const { FilasCleanupController } = api(
    "resources/filas/filas-cleanup.controller.js",
  );
  const { DGP_QUEUE } = api("resources/filas/filas.constants.js");
  const { PrismaService } = api("prisma/prisma.service.js");
  const { JwtStrategy } = api("resources/auth/jwt.strategy.js");
  const secret = randomUUID() + randomUUID();
  const jwt = new JwtService({ secret });
  const token = jwt.sign({ sub: "test", role: "ADMIN" });
  const statusQueues = Object.fromEntries(
    req("@oda/shared-types").FilaStatusNomeSchema.options.map((f) => [
      f,
      queue,
    ]),
  );
  const module = await Test.createTestingModule({
    controllers: [
      PipelineController,
      ConsistencyController,
      FilasStatusController,
      FilasCleanupController,
    ],
    providers: [
      PipelineService,
      LogsExportService,
      FilasStatusService,
      FilasCleanupService,
      JwtStrategy,
      {
        provide: ConfigService,
        useValue: new ConfigService({ JWT_SECRET: secret }),
      },
      { provide: PrismaService, useValue: db },
      { provide: DGP_QUEUE, useValue: queue },
      { provide: FILAS_STATUS_QUEUES, useValue: statusQueues },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  api("common/api-versioning.js").configureApiVersioning(app);
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ZodSerializerInterceptor(app.get(Reflector)));
  await app.init();
  try {
    const auth = (path) =>
      request(app.getHttpServer()).get(path).auth(token, { type: "bearer" });
    await request(app.getHttpServer()).get("/v1/admin/filas").expect(401);
    await request(app.getHttpServer())
      .get("/v1/admin/filas")
      .auth(jwt.sign({ sub: "test", role: "USER" }), { type: "bearer" })
      .expect(401);
    const statuses = await auth("/v1/admin/filas").expect(200);
    assert.equal(statuses.body.total, 11);
    await auth("/v1/admin/filas/etl-pesquisadores/status").expect(200);
    await auth("/v1/admin/filas/desconhecida/status").expect(400);
    const from = "?dataInicio=2020-01-01&dataFim=2020-12-31";
    await auth("/v1/admin/logs/metricas" + from).expect(200);
    await auth("/v1/admin/logs/metricas?dataInicio=2026-02-30").expect(400);
    const current = await auth("/v1/admin/logs/metricas").expect(200);
    assert.ok(current.body.resumo.processados >= 2);
    await auth("/v1/admin/logs/execucoes").expect(200);
    await auth("/v1/admin/logs/itens").expect(200);
    await auth("/v1/admin/logs/execucoes/" + active.id).expect(200);
    await auth("/v1/admin/consistencia-dados/ultima").expect(200);
    await auth("/v1/admin/consistencia-dados/historico").expect(200);
    await auth("/v1/admin/logs/exportacao?formato=json").expect(200);
    await auth("/v1/admin/logs/exportacao?formato=csv").expect(200);
    const getWorkers = queue.getWorkers;
    queue.getWorkers = async () => {
      throw new Error("indisponível");
    };
    await auth("/v1/admin/filas").expect(503);
    await auth("/v1/admin/logs/metricas").expect(200);
    queue.getWorkers = getWorkers;
    const doc = api("common/openapi.js").createApiDocument(app);
    assert.ok(doc.paths["/v1/admin/filas"].get.responses["200"]);
    assert.ok(doc.paths["/v1/admin/logs/metricas"].get.security.length);
    assert.ok(
      doc.paths["/v1/admin/consistencia-dados/ultima"].get.responses["200"],
    );
    console.log(
      "PASS HTTP real: JWT, contratos Zod, Swagger, filtros, exportação e histórico independente de Redis",
    );
  } finally {
    await app.close();
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (worker) await worker.close();
    if (queue) await queue.close();
    if (db) await db.$disconnect();
    for (const name of started.reverse()) {
      try {
        docker("stop", "-t", "2", name);
      } catch (e) {
        console.error(e.message);
      }
    }
  });
