const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
process.env.OPEN_AI_KEY = '';
const { parseSimccArgs, validateManifest } = require('../dist/scripts/reindexSimcc');
const { hasAcronym, REQUIRED_ACRONYMS } = require('../dist/scripts/simcc/selection');
const { markCompleted, readCheckpoint, withRunLock } = require('../dist/scripts/simcc/state');

test('help e preparo não carregam o cliente de embeddings', () => {
  assert.equal(parseSimccArgs([]).mode, 'help');
  assert.equal(parseSimccArgs(['--prepare']).mode, 'prepare');
  assert(!Object.keys(require.cache).some(file => /[\\/]core[\\/]config\.js$/.test(file)));
});

test('inclui as quatro siglas e diferencia siglas de pedaços de palavras', () => {
  assert.deepEqual(REQUIRED_ACRONYMS, ['NPAI', 'G2BC', 'ACSO', 'PIMAT']);
  assert(hasAcronym('Grupo de pesquisa (pimat)', 'PIMAT'));
  assert(!hasAcronym('Grupo PIMAT2', 'PIMAT'));
});

test('rejeita flags conflitantes ou sem valor', () => {
  for (const args of [['--prepare', '--apply'], ['--apply', '--replace'], ['--include'], ['--apply', '--include', 'X'], ['--limit', '3']]) {
    assert.throws(() => parseSimccArgs(args));
  }
  assert.deepEqual(parseSimccArgs(['--prepare', '--include', 'OUTRA']).include, ['OUTRA']);
});

test('manifesto inválido não pode definir um caminho arbitrário de checkpoint', () => {
  assert.throws(() => validateManifest({ version: 1, runId: '../../outro' }));
});

test('checkpoint retém o hash mais recente e recupera somente um último registro incompleto', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oda-simcc-state-'));
  try {
    const file = path.join(dir, 'progress.jsonl');
    await markCompleted(file, 'grupo:1', 'hash-1');
    await markCompleted(file, 'grupo:1', 'hash-2');
    const good = await readFile(file, 'utf8');
    await writeFile(file, good + '{"key":');
    assert.equal((await readCheckpoint(file)).get('grupo:1'), 'hash-2');
    assert.equal(await readFile(file, 'utf8'), good);
    await writeFile(file, 'inválido\n' + good);
    await assert.rejects(readCheckpoint(file));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('lock impede duas execuções e é liberado após falha', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'oda-simcc-lock-'));
  try {
    await assert.rejects(withRunLock(dir, async () => {
      await assert.rejects(withRunLock(dir, async () => {}), /Já existe/);
      throw new Error('falha simulada');
    }), /falha simulada/);
    assert.equal(await withRunLock(dir, async () => 'liberado'), 'liberado');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
