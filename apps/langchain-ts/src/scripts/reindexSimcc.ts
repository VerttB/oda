import { randomUUID } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaClient } from '@oda/database';
import type { RagDocumentInput } from '../services/ragIndexer';
import { loadDocuments, selectedSources } from './simcc/documents';
import { CERTIFIED_SIMCC_WHERE, REQUIRED_ACRONYMS, selectSimccBatch, SIMCC_BATCH_SIZE, SimccSelection } from './simcc/selection';
import { fingerprint, markCompleted, readCheckpoint, saveJson, withRunLock } from './simcc/state';

export type SimccManifest = SimccSelection & {
  version: 1; runId: string; preparedAt: string; target: string;
};
type Indexer = (db: PrismaClient, input: RagDocumentInput, options: { force: true }) => Promise<{ indexed: boolean; chunks: number }>;

export function parseSimccArgs(args: string[]) {
  let mode: 'prepare' | 'apply' | 'help' | undefined;
  let replace = false;
  let directory = path.resolve(__dirname, '../../data/reindex-simcc-200');
  const include: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help') return { mode: 'help' as const, replace, directory, include };
    if (flag === '--prepare' || flag === '--apply') {
      if (mode) throw new Error('Escolha somente --prepare ou --apply.');
      mode = flag === '--prepare' ? 'prepare' : 'apply';
    } else if (flag === '--replace') replace = true;
    else if (flag === '--include' || flag === '--state-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${flag} exige um valor.`);
      if (flag === '--include') include.push(value);
      else directory = path.resolve(value);
    } else throw new Error(`Opção desconhecida: ${flag}`);
  }
  if (mode === 'apply' && (replace || include.length)) throw new Error('--replace e --include pertencem ao preparo do manifesto.');
  return { mode: mode ?? 'help', replace, directory, include };
}

function selectionOf(manifest: SimccManifest): SimccSelection {
  return { requiredAcronyms: manifest.requiredAcronyms, groups: manifest.groups, related: manifest.related, counts: manifest.counts };
}

export function validateManifest(manifest: SimccManifest): void {
  if (manifest.version !== 1 || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(manifest.runId)
      || !Array.isArray(manifest.groups) || manifest.groups.length !== SIMCC_BATCH_SIZE
      || new Set(manifest.groups.map(group => group.id)).size !== SIMCC_BATCH_SIZE
      || !Array.isArray(manifest.requiredAcronyms) || REQUIRED_ACRONYMS.some(value => !manifest.requiredAcronyms.includes(value))
      || !manifest.related || !manifest.counts || typeof manifest.target !== 'string') {
    throw new Error('Manifesto SIMCC inválido: prepare novamente um lote de 200 com as quatro siglas obrigatórias.');
  }
}

export async function applySimccManifest(db: PrismaClient, manifest: SimccManifest, checkpoint: string, indexer: Indexer) {
  validateManifest(manifest);
  const current = await db.$transaction(tx => selectSimccBatch(tx, manifest.requiredAcronyms), {
    isolationLevel: 'RepeatableRead', timeout: 60_000,
  });
  if (fingerprint(current) !== fingerprint(selectionOf(manifest))) {
    throw new Error('Seleção ou relações mudaram desde o preparo; use --prepare --replace antes de gerar embeddings.');
  }
  const completed = await readCheckpoint(checkpoint);
  let indexed = 0;
  let resumed = 0;
  for (const source of selectedSources(manifest)) {
    for (let start = 0; start < source.ids.length; start += 25) {
      const ids = source.ids.slice(start, start + 25);
      const eligible = await db.grupoPesquisa.count({
        where: { AND: [CERTIFIED_SIMCC_WHERE, { id: { in: manifest.groups.map(group => group.id) } }] },
      });
      if (eligible !== SIMCC_BATCH_SIZE) throw new Error('Um grupo deixou de ser SIMCC certificado; execução interrompida com progresso preservado.');
      const documents = await loadDocuments(db, source.type, ids);
      if (documents.length !== ids.length || documents.some(document => !ids.includes(document.sourceId))) {
        throw new Error(`Entidade ausente ou inelegível em ${source.type}; execução interrompida com checkpoint preservado.`);
      }
      const pending = documents.filter(document => {
        const same = completed.get(`${document.sourceType}:${document.sourceId}`) === fingerprint(document);
        if (same) resumed++;
        return !same;
      });
      for (let offset = 0; offset < pending.length; offset += 2) {
        const batch = pending.slice(offset, offset + 2);
        const results = await Promise.allSettled(batch.map(document => indexer(db, document, { force: true })));
        const failures: string[] = [];
        for (let index = 0; index < results.length; index++) {
          const result = results[index];
          const document = batch[index];
          if (result.status === 'rejected' || !result.value.indexed) {
            const cause = result.status === 'rejected'
              ? result.reason instanceof Error ? result.reason.message : String(result.reason)
              : 'Indexador não regenerou o documento.';
            failures.push(`${document.sourceType}:${document.sourceId}: ${cause}`);
            continue;
          }
          const key = `${document.sourceType}:${document.sourceId}`;
          const hash = fingerprint(document);
          await markCompleted(checkpoint, key, hash);
          completed.set(key, hash);
          indexed++;
        }
        if (failures.length) throw new Error(`Falha ao regenerar ${failures.join(', ')}. Consulte indexing_job; repita --apply para retomar.`);
      }
      console.log(`[${source.type}] ${Math.min(start + ids.length, source.ids.length)}/${source.ids.length}; regenerados=${indexed}; retomados=${resumed}`);
    }
  }
  return { indexed, resumed, documents: manifest.counts.documents };
}

function databaseTarget(): string {
  const url = new URL(process.env.DATABASE_URL ?? '');
  return `${url.hostname}:${url.port || '5432'}${url.pathname}?schema=${url.searchParams.get('schema') || 'public'}`;
}

function printManifest(manifest: SimccManifest): void {
  console.log(`Destino: ${manifest.target}`);
  console.log(`SIMCC: ${manifest.counts.groups} grupos CERTIFICADOS; ${manifest.counts.researchers} pesquisadores; ${manifest.counts.lines} linhas; ${manifest.counts.productions} produções.`);
  console.log(`Total: ${manifest.counts.documents} documentos; ${manifest.counts.sectors} setores incluídos no texto das linhas.`);
  console.table(manifest.groups.filter(group => group.obrigatorio.length).map(group => ({ siglas: group.obrigatorio.join(', '), grupo: group.nome, id: group.id })));
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const options = parseSimccArgs(args);
  if (options.mode === 'help') {
    console.log([
      'Regenera 200 grupos SIMCC CERTIFICADOS e seus pesquisadores, linhas e produções; setores são incluídos nas linhas.',
      'Obrigatórios: NPAI, G2BC, ACSO e PIMAT. Completa pelos grupos com mais membros, com desempate por ID.',
      '--prepare           Salva e mostra o lote; não gera embeddings nem altera tabelas de RAG.',
      '--prepare --replace Prepara uma nova execução, mesmo quando já existe manifesto.',
      '--include SIGLA     Acrescenta uma sigla obrigatória no preparo (opção repetível).',
      '--apply             Força embeddings no OpenAI; retoma o checkpoint do manifesto atual.',
      '--state-dir PASTA   Define onde salvar manifesto e checkpoint (padrão: data/reindex-simcc-200 do serviço).',
    ].join('\n'));
    return;
  }
  const { prisma }: { prisma: PrismaClient } = require('../core/db');
  try {
    await withRunLock(options.directory, async () => {
      const file = path.join(options.directory, 'manifest.json');
      const target = databaseTarget();
      if (options.mode === 'prepare') {
        if (!options.replace) {
          let exists = false;
          try { await access(file); exists = true; }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
          if (exists) throw new Error('Manifesto já existe. Use --apply para retomar ou --prepare --replace para um novo lote.');
        }
        const selection = await prisma.$transaction(tx => selectSimccBatch(tx, options.include), { isolationLevel: 'RepeatableRead', timeout: 60_000 });
        const manifest: SimccManifest = { ...selection, version: 1, runId: randomUUID(), preparedAt: new Date().toISOString(), target };
        await saveJson(file, manifest);
        printManifest(manifest);
        console.log(`Manifesto: ${file}. Preparo concluído sem gerar embeddings.`);
      } else {
        const manifest = JSON.parse(await readFile(file, 'utf8')) as SimccManifest;
        validateManifest(manifest);
        if (manifest.target !== target) throw new Error('O destino difere do manifesto; faça o preparo e a aplicação no mesmo ambiente.');
        printManifest(manifest);
        if (!process.env.OPEN_AI_KEY) throw new Error('OPEN_AI_KEY não configurada; nenhuma geração iniciada.');
        const { indexRagDocument }: { indexRagDocument: Indexer } = require('../services/ragIndexer');
        const checkpoint = path.join(options.directory, `progress-${manifest.runId}.jsonl`);
        const result = await applySimccManifest(prisma, manifest, checkpoint, indexRagDocument);
        console.log(`Lote concluído: ${result.indexed} regenerados, ${result.resumed} já concluídos. Checkpoint: ${checkpoint}`);
      }
    });
  } finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch(error => {
  let message = error instanceof Error ? error.message : String(error);
  const secrets = [process.env.DATABASE_URL, process.env.OPEN_AI_KEY];
  try { secrets.push(decodeURIComponent(new URL(process.env.DATABASE_URL ?? '').password)); } catch { /* URL ausente. */ }
  for (const secret of secrets) if (secret) message = message.split(secret).join('[redigido]');
  console.error(`Falha no lote SIMCC: ${message}`);
  process.exitCode = 1;
});
