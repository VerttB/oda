const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "oda-obs-files-"));
process.env.SCRAPER_DATA_DIR = root;
const { AdaptiveEtlPolicy } = require("../dist/queue/adaptiveConcurrency");
const { verifyGroupPersistence } = require("../dist/dgp/verifyPersistence");

test("política exige três amostras e estabiliza a redução; pressão impede aumento", () => {
  const p = new AdaptiveEtlPolicy(),
    base = 1000000;
  const high = {
    waiting: 2000,
    memoryFreeRatio: 0.5,
    cpuLoadRatio: 0.3,
    databaseReady: true,
  };
  assert.equal(p.sample(high, base).current, 1);
  assert.equal(p.sample(high, base + 30000).current, 1);
  assert.equal(p.sample(high, base + 60000).current, 2);
  assert.equal(p.sample({ ...high, waiting: 250 }, base + 90000).current, 2);
  assert.equal(p.sample({ ...high, waiting: 250 }, base + 120000).current, 2);
  assert.equal(p.sample({ ...high, waiting: 250 }, base + 400000).current, 1);
  assert.equal(
    p.sample({ ...high, memoryFreeRatio: 0.1 }, base + 500000).current,
    1,
  );
  p.current = 2;
  assert.equal(
    p.sample({ ...high, databaseReady: false }, base + 600000).current,
    1,
  );
});

test("conferência detecta membro não persistido e aceita vínculos adicionais", async () => {
  const data = {
    idDgp: "1234567890123456",
    membros: [{ nome: "Pessoa", lattes: "1111111111111111" }],
    linhas: [{ nome: "Linha A" }],
  };
  const db = {
    grupoPesquisa: {
      findUniqueOrThrow: async () => ({
        membros: [],
        linhasPesquisa: [{ titulo: "Linha A" }],
      }),
    },
  };
  await assert.rejects(verifyGroupPersistence(db, data), /Conferência/);
  db.grupoPesquisa.findUniqueOrThrow = async () => ({
    membros: [
      { pesquisador: { nome: "Pessoa", lattesId: "1111111111111111" } },
      { pesquisador: { nome: "Outra", lattesId: null } },
    ],
    linhasPesquisa: [{ titulo: "Linha A" }],
  });
  assert.equal((await verifyGroupPersistence(db, data)).membrosAusentes, 0);
});

test("recoleta arquiva a versão anterior e diagnóstico não altera arquivos", async () => {
  const { moveEtlFileToProcessed } = require("../dist/commom/etlFile");
  const { inspectRaw } = require("../dist/queue/rawDiagnostics");
  try {
    const raw = path.join(root, "raw-data", "lattes");
    fs.mkdirSync(raw, { recursive: true });
    const file = path.join(raw, "1234567890123456.json");
    fs.writeFileSync(file, '{"version":1}');
    assert.equal(moveEtlFileToProcessed(file, "lattes"), true);
    fs.writeFileSync(file, '{"version":2}');
    const queue = { getJob: async () => undefined };
    const result = await inspectRaw("default", queue, queue);
    assert.equal(result.total, 1);
    assert.equal(result.amostra[0].estado, "SEM_JOB");
    assert.ok(fs.existsSync(file));
    assert.equal(moveEtlFileToProcessed(file, "lattes"), true);
    const target = path.join(root, "processed-data", "lattes");
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(target, path.basename(file))))
        .version,
      2,
    );
    const versions = fs.readdirSync(
      path.join(target, ".versions", "1234567890123456"),
    );
    assert.equal(versions.length, 1);
    assert.equal(
      JSON.parse(
        fs.readFileSync(
          path.join(target, ".versions", "1234567890123456", versions[0]),
        ),
      ).version,
      1,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
