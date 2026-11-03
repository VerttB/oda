// Executa a imagem real em PostgreSQL descartavel, sem ler .env ou publicar portas.
// Antes: docker compose build migrate
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'shared/database/prisma/migrations');
const migrations = readdirSync(migrationsDir, { withFileTypes: true }).filter(item => item.isDirectory());
const initialSql = readFileSync(path.join(migrationsDir, '0_init/migration.sql'), 'utf8');
const expectedTables = [...initialSql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(match => match[1]);
const container = `oda-migrations-test-${process.pid}-${randomBytes(4).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const database = 'oda_migrations_test';
const legacyDatabase = 'oda_migrations_legacy_test';
let started = false;

function docker(...args) {
  const result = spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout || ''}\n${result.stderr || ''}`.trim() };
}

function success(result) {
  assert.equal(result.status, 0, result.output);
  return result.output;
}

function sql(query, target = database) {
  return success(docker('exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-U', 'postgres', '-d', target, '-At', '-c', query));
}

function migrate(action, target = database) {
  const url = `postgresql://postgres:${password}@127.0.0.1:5432/${target}`;
  return docker('run', '--rm', '--network', `container:${container}`,
    '-e', `DATABASE_URL=${url}`, 'oda-migrate:local', action);
}

async function main() {
  try {
    success(docker('image', 'inspect', 'oda-migrate:local', '--format', '{{.Id}}'));
    success(docker('run', '--rm', '-d', '--name', container,
      '--tmpfs', '/var/lib/postgresql:rw,nosuid,size=256m',
      '-e', `POSTGRES_DB=${database}`, '-e', `POSTGRES_PASSWORD=${password}`,
      'pgvector/pgvector:pg18-trixie'));
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', database).status === 0) {
        ready = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'PostgreSQL de teste nao iniciou.');

    assert.equal(migrate('status').status, 1, 'Banco vazio deve indicar migrations pendentes.');
    assert.equal(sql("SELECT to_regclass('public._prisma_migrations') IS NULL"), 't');
    console.log('PASS: status consulta banco vazio sem criar historico ou tabelas.');

    success(migrate('deploy'));
    const tables = new Set(sql("SELECT tablename FROM pg_tables WHERE schemaname = 'public'").split('\n'));
    assert.ok(expectedTables.length > 0);
    for (const table of expectedTables) assert.ok(tables.has(table), `Tabela ausente: ${table}`);
    assert.equal(Number(sql('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')), migrations.length);
    assert.equal(sql("SELECT to_regclass('public.mv_metricas_sistema') IS NOT NULL AND to_regclass('public.producao_ano_lower_titulo_idx') IS NOT NULL AND to_regclass('public.producao_busca_booleana_gin_idx') IS NOT NULL"), 't');
    console.log('PASS: deploy cria tabelas, view e indices das migrations existentes.');

    const id = randomUUID();
    sql(`INSERT INTO producao (id, titulo, ano, tipo, criado_em, atualizado_em)
      VALUES ('${id}', 'Fisica de plasma', 2026, 'artigo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
    assert.equal(sql(`SELECT busca_textual @@ plainto_tsquery('public.oda_producoes', 'plasma') FROM producao WHERE id = '${id}'`), 't');
    success(migrate('deploy'));
    assert.equal(sql(`SELECT titulo FROM producao WHERE id = '${id}'`), 'Fisica de plasma');
    success(migrate('status'));
    assert.equal(Number(sql('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')), migrations.length);
    console.log('PASS: reexecucao preserva dados e historico; vetor textual e status funcionam.');

    sql(`CREATE DATABASE ${legacyDatabase}`);
    sql('CREATE TABLE legado_teste (id integer PRIMARY KEY); INSERT INTO legado_teste VALUES (1)', legacyDatabase);
    const legacy = migrate('deploy', legacyDatabase);
    assert.notEqual(legacy.status, 0);
    assert.match(legacy.output, /P3005/);
    assert.equal(sql('SELECT count(*) FROM legado_teste', legacyDatabase), '1');
    assert.equal(sql("SELECT to_regclass('public.grupo_pesquisa') IS NULL", legacyDatabase), 't');
    console.log('PASS: banco existente sem historico e recusado sem apagar dados ou marcar baseline.');
  } finally {
    if (started) success(docker('stop', '-t', '5', container));
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
