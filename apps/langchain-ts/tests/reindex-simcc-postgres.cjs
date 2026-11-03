const { execFileSync, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const container = `oda-simcc-reindex-test-${process.pid}`;
const password = randomBytes(24).toString('hex');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let started = false;
let prisma;
let directory;

async function main() {
  try {
    docker('run', '--rm', '-d', '--name', container, '-p', '127.0.0.1::5432',
      '-e', 'POSTGRES_DB=oda_simcc_test', '-e', `POSTGRES_PASSWORD=${password}`, 'pgvector/pgvector:pg18-trixie');
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { docker('exec', container, 'pg_isready', '-U', 'postgres', '-d', 'oda_simcc_test'); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 300)); }
    }
    assert(ready);
    const port = docker('port', container, '5432/tcp').split(':').at(-1);
    const url = `postgresql://postgres:${password}@127.0.0.1:${port}/oda_simcc_test`;
    process.env.DATABASE_URL = url;
    process.env.OPEN_AI_KEY = 'teste-sintetico-sem-envio-externo';
    execFileSync(process.execPath, [path.join(root, 'shared/database/node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: path.join(root, 'shared/database'), env: process.env, encoding: 'utf8', timeout: 120_000,
    });
    const { PrismaClient } = require('@oda/database');
    const { PrismaPg } = require('@prisma/adapter-pg');
    prisma = new PrismaClient({ adapter: new PrismaPg(url) });
    const { selectSimccBatch } = require('../dist/scripts/simcc/selection');
    const { loadDocuments } = require('../dist/scripts/simcc/documents');
    const { applySimccManifest } = require('../dist/scripts/reindexSimcc');
    await prisma.instituicao.createMany({ data: [
      { id: 'ufba', nome: 'Universidade Federal da Bahia', sigla: 'UFBA' },
      { id: 'uneb', nome: 'Universidade do Estado da Bahia', sigla: 'UNEB' },
      { id: 'ifba', nome: 'Instituto Federal da Bahia - Salvador', sigla: 'IFBA - Salvador' },
      { id: 'moniz', nome: 'Instituto Gonçalo Moniz', sigla: 'FIOCRUZ' },
      { id: 'outro', nome: 'Outra instituição', sigla: 'OUT' },
      { id: 'fiocruz-fora', nome: 'Instituto Oswaldo Cruz', sigla: 'FIOCRUZ' },
    ] });
    const mandatory = ['NPAI', 'G2BC', 'ACSO', 'PIMAT'].map(sigla => ({
      id: `required-${sigla}`, nome: `Grupo obrigatório - ${sigla}`, areaPredominante: 'Computação', situacao: 'CERTIFICADO',
    }));
    const regular = Array.from({ length: 203 }, (_, i) => ({
      id: `base-${String(i).padStart(3, '0')}`, nome: `Grupo regular ${i}`, areaPredominante: 'Computação',
      situacao: i === 3 ? 'INATIVO' : i === 4 ? 'EM_PREENCHIMENTO' : 'CERTIFICADO',
    }));
    const excluded = ['outside', 'fiocruz-other'].map(id => ({ id, nome: id, areaPredominante: 'Outra', situacao: 'CERTIFICADO' }));
    await prisma.grupoPesquisa.createMany({ data: [...mandatory, ...regular, ...excluded] });
    await prisma.grupoPesquisaInstituicao.createMany({ data: [
      ...mandatory.map(group => ({ grupoId: group.id, instituicaoId: 'ufba', tipoRelacao: 'SEDE' })),
      ...regular.map((group, i) => ({ grupoId: group.id, instituicaoId: i === 1 ? 'ifba' : i === 2 ? 'moniz' : 'ufba', tipoRelacao: 'SEDE' })),
      { grupoId: 'base-005', instituicaoId: 'uneb', tipoRelacao: 'PARCEIRA' },
      { grupoId: 'outside', instituicaoId: 'outro', tipoRelacao: 'SEDE' },
      { grupoId: 'outside', instituicaoId: 'ufba', tipoRelacao: 'PARCEIRA' },
      { grupoId: 'fiocruz-other', instituicaoId: 'fiocruz-fora', tipoRelacao: 'SEDE' },
    ] });
    await prisma.pesquisador.createMany({ data: ['shared', 'second', 'line-only', 'outside'].map(id => ({ id, nome: `Pessoa sintética ${id}` })) });
    await prisma.membroGrupo.createMany({ data: [
      ...regular.map(group => ({ grupoId: group.id, pesquisadorId: 'shared' })),
      { grupoId: 'base-000', pesquisadorId: 'second' }, { grupoId: 'outside', pesquisadorId: 'outside' },
    ] });
    await prisma.linhaPesquisa.createMany({ data: [
      { id: 'line-a', grupoId: 'base-000', titulo: 'Linha A' },
      { id: 'line-b', grupoId: 'required-ACSO', titulo: 'Linha B' },
      { id: 'line-out', grupoId: 'outside', titulo: 'Linha fora' },
    ] });
    await prisma.membroLinhaPesquisa.createMany({ data: [
      { linhaPesquisaId: 'line-a', pesquisadorId: 'shared' },
      { linhaPesquisaId: 'line-b', pesquisadorId: 'line-only' },
    ] });
    await prisma.setorAplicacao.create({ data: { id: 'sector', nome: 'Setor de teste', nomeNormalizado: 'setor de teste' } });
    await prisma.linhaPesquisaSetorAplicacao.createMany({ data: ['line-a', 'line-b'].map(linhaPesquisaId => ({ linhaPesquisaId, setorAplicacaoId: 'sector' })) });
    await prisma.producao.createMany({ data: ['shared-work', 'line-work', 'outside-work'].map(id => ({ id, titulo: id, resumo: 'Resumo sintético' })) });
    await prisma.producaoPesquisador.createMany({ data: [
      { producaoId: 'shared-work', pesquisadorId: 'shared' }, { producaoId: 'shared-work', pesquisadorId: 'second' },
      { producaoId: 'line-work', pesquisadorId: 'line-only' }, { producaoId: 'outside-work', pesquisadorId: 'outside' },
    ] });

    const selection = await selectSimccBatch(prisma);
    assert.equal(selection.groups.length, 200);
    assert.equal(new Set(selection.groups.map(group => group.id)).size, 200);
    mandatory.forEach(group => assert(selection.groups.some(item => item.id === group.id)));
    for (const id of ['base-000', 'base-001', 'base-002']) assert(selection.groups.some(group => group.id === id));
    for (const id of ['outside', 'fiocruz-other', 'base-003', 'base-004', 'base-202']) assert(!selection.groups.some(group => group.id === id));
    assert.deepEqual(selection.related.researcherIds, ['line-only', 'second', 'shared']);
    assert.deepEqual(selection.related.productionIds, ['line-work', 'shared-work']);
    assert.equal(selection.counts.sectors, 1);
    assert.equal(selection.counts.documents, 207);
    console.log('PASS: seleção de 200, quatro siglas, ranking, sedes, campus IFBA, Moniz e deduplicação dos relacionados.');

    const previous = await prisma.ragDocument.create({ data: { sourceType: 'GRUPO_PESQUISA', sourceId: 'required-ACSO', titulo: 'Anterior', conteudo: 'Anterior válido' } });
    const outside = await prisma.ragDocument.create({ data: { sourceType: 'GRUPO_PESQUISA', sourceId: 'outside', titulo: 'Fora', conteudo: 'Preservar fora' } });
    const vector = `[${Array(1536).fill(0.01).join(',')}]`;
    for (const document of [previous, outside]) await prisma.$executeRaw`
      INSERT INTO rag_chunk (id,document_id,conteudo,embedding,ordem,atualizado_em)
      VALUES (${`old-${document.id}`},${document.id},${document.conteudo},${vector}::vector,0,now())
    `;
    directory = await mkdtemp(path.join(os.tmpdir(), 'oda-simcc-pg-'));
    const cli = path.join(root, 'apps/langchain-ts/dist/scripts/reindexSimcc.js');
    const environment = { ...process.env, DATABASE_URL: url, OPEN_AI_KEY: '' };
    const prepared = execFileSync(process.execPath, [cli, '--prepare', '--state-dir', directory], { env: environment, encoding: 'utf8' });
    assert(prepared.includes('PIMAT'));
    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.counts.documents, 207);
    assert(!JSON.stringify(manifest).includes(password));
    assert.equal(await prisma.ragDocument.count(), 2);
    const denied = spawnSync(process.execPath, [cli, '--apply', '--state-dir', directory], { env: environment, encoding: 'utf8' });
    assert.equal(denied.status, 1);
    assert(denied.stderr.includes('OPEN_AI_KEY'));
    assert.equal(await prisma.ragDocument.count(), 2);
    console.log('PASS: CLI prepara sem chave, sem alterar RAG; --apply sem chave é recusado.');

    global.fetch = async () => { throw new Error('Chamada externa proibida no teste.'); };
    const { embeddings } = require('../dist/core/config');
    let calls = 0;
    let failOnce = true;
    embeddings.embedDocuments = async texts => {
      calls++;
      if (failOnce && texts.some(text => text.includes('Grupo obrigatório - ACSO'))) {
        failOnce = false;
        throw new Error('Falha sintética no provedor');
      }
      return texts.map(() => Array(1536).fill(0.01));
    };
    const { indexRagDocument } = require('../dist/services/ragIndexer');
    const indexer = (db, input, options) => {
      assert.equal(options.force, true);
      assert(input.sourceType !== 'GRUPO_PESQUISA' || manifest.groups.some(group => group.id === input.sourceId));
      return indexRagDocument(db, input, options);
    };
    const checkpoint = path.join(directory, `progress-${manifest.runId}.jsonl`);
    await assert.rejects(applySimccManifest(prisma, manifest, checkpoint, indexer), /Falha ao regenerar/);
    const alreadyCompleted = new Set((await readFile(checkpoint, 'utf8')).trim().split('\n').map(line => JSON.parse(line).key)).size;
    assert(alreadyCompleted > 0 && alreadyCompleted < manifest.counts.documents);
    assert.equal((await prisma.ragDocument.findUnique({ where: { id: previous.id } })).conteudo, 'Anterior válido');
    assert.equal(await prisma.ragChunk.count({ where: { documentId: previous.id } }), 1);
    const result = await applySimccManifest(prisma, manifest, checkpoint, indexer);
    assert.equal(result.indexed, manifest.counts.documents - alreadyCompleted);
    assert.equal(result.resumed, alreadyCompleted);
    assert.equal(await prisma.ragDocument.count(), 208);
    assert.equal((await prisma.ragDocument.findUnique({ where: { id: outside.id } })).conteudo, 'Preservar fora');
    assert.equal(await prisma.ragChunk.count({ where: { documentId: outside.id } }), 1);
    const before = calls;
    const resumed = await applySimccManifest(prisma, manifest, checkpoint, indexer);
    assert.equal(resumed.indexed, 0);
    assert.equal(resumed.resumed, 207);
    assert.equal(calls, before);
    await prisma.grupoPesquisa.update({ where: { id: 'base-000' }, data: { repercussao: 'Texto atualizado' } });
    const changed = await applySimccManifest(prisma, manifest, checkpoint, indexer);
    assert.equal(changed.indexed, 1);
    const lines = await loadDocuments(prisma, 'LINHA_PESQUISA', ['line-a', 'line-b']);
    assert(lines.every(line => line.content.includes('Setor de teste')));
    await prisma.grupoPesquisa.update({ where: { id: 'required-NPAI' }, data: { situacao: 'INATIVO' } });
    const callsBeforeInvalidation = calls;
    await assert.rejects(applySimccManifest(prisma, manifest, checkpoint, indexer), /NPAI/);
    assert.equal(calls, callsBeforeInvalidation);
    console.log('PASS: embeddings simulados; falha/retomada, force, reexecução, mudança de conteúdo, setores e preservação de documentos fora do lote.');
  } finally {
    try { if (prisma) await prisma.$disconnect(); }
    finally {
      if (started) docker('rm', '-f', container);
      if (directory) {
        assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
        assert(path.basename(directory).startsWith('oda-simcc-pg-'));
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
}
main().catch(error => {
  console.error(String(error.stack ?? error).replaceAll(password, '[redigido]'));
  process.exitCode = 1;
});
