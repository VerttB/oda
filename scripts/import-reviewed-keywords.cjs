const { readFile } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { parseArgs } = require('node:util');

const workspace = createRequire(resolve(__dirname, '../apps/api/package.json'));

function parseReview(input) {
  const file = JSON.parse(input);
  if (file?.versao !== 1 || file.destino !== 'pt-BR' || !Array.isArray(file.termos) ||
      !file.termos.length || file.termos.length > 200) {
    throw new Error('Informe um lote de revisão versão 1, pt-BR, com 1 a 200 termos.');
  }
  const ids = new Set();
  for (const term of file.termos) {
    if (typeof term?.externalId !== 'string' || !/^https:\/\/openalex\.org\/keywords\/[a-zA-Z0-9_-]+$/.test(term.externalId) ||
        typeof term.original !== 'string' || !term.original.trim() || ids.has(term.externalId) ||
        !['REVISADA', 'PENDENTE'].includes(term.status) ||
        (term.status === 'REVISADA' && (typeof term.termo !== 'string' || !term.termo.trim() || term.termo.length > 500)) ||
        (term.idiomaOriginal != null && (typeof term.idiomaOriginal !== 'string' || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(term.idiomaOriginal)))) {
      throw new Error('Termo inválido ou repetido no lote de revisão.');
    }
    ids.add(term.externalId);
  }
  return file;
}

async function importReview(db, file, { apply, keywordSearchKey }) {
  return db.$transaction(async tx => {
    if (!apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const summary = { selecionados: file.termos.length, pendentes: 0, preservados: 0, ausentesOuDivergentes: 0, planejados: 0, gravados: 0 };
    for (const item of [...file.termos].sort((a, b) => a.externalId.localeCompare(b.externalId))) {
      if (item.status === 'PENDENTE') { summary.pendentes++; continue; }
      const where = { origem: 'OPENALEX', externalId: item.externalId, termoOriginal: item.original };
      const word = await tx.palavraChave.findFirst({ where, select: { traducaoStatus: true, traducaoMetadata: true } });
      if (!word) { summary.ausentesOuDivergentes++; continue; }
      if (!['PENDENTE', 'AUTOMATICA'].includes(word.traducaoStatus)) { summary.preservados++; continue; }
      summary.planejados++;
      if (!apply) continue;
      const termo = item.termo.trim();
      const result = await tx.palavraChave.updateMany({
        where: { ...where, traducaoStatus: { in: ['PENDENTE', 'AUTOMATICA'] } },
        data: {
          termo, termoNormalizado: keywordSearchKey(termo), traducaoStatus: 'REVISADA',
          ...(item.idiomaOriginal ? { idiomaOriginal: item.idiomaOriginal } : {}),
          traducaoMetadata: {
            ...(word.traducaoMetadata && typeof word.traducaoMetadata === 'object' && !Array.isArray(word.traducaoMetadata) ? word.traducaoMetadata : {}),
            provedor: 'Azure Translator', tipoRevisao: 'ASSISTIDA', versaoRevisao: file.versao,
            revisadoEm: new Date().toISOString(),
          },
        },
      });
      summary.gravados += result.count;
    }
    return summary;
  }, { timeout: 30_000 });
}

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: 'string' }, apply: { type: 'boolean' }, help: { type: 'boolean' },
  } });
  const usage = 'Defina ODA_PILOT_DATABASE_URL para um PostgreSQL local e use --input ARQUIVO.json [--apply].';
  if (values.help) { console.log(usage); return; }
  const connectionString = process.env.ODA_PILOT_DATABASE_URL;
  if (!values.input || !connectionString) throw new Error(usage);
  const target = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error('O importador desta amostra usa somente PostgreSQL em loopback.');
  }
  const file = parseReview(await readFile(values.input, 'utf8'));
  process.env.DATABASE_URL = connectionString;
  const { PrismaClient, prismaConfig } = workspace('@oda/database');
  const { keywordSearchKey } = workspace('@oda/shared-types');
  const db = new PrismaClient(prismaConfig);
  try {
    console.log(JSON.stringify({
      destino: target.host + target.pathname, modo: values.apply ? 'GRAVACAO' : 'SIMULACAO',
      ...await importReview(db, file, { apply: values.apply, keywordSearchKey }),
    }));
  } finally {
    await db.$disconnect();
  }
}

module.exports = { importReview, parseReview };

if (require.main === module) main().catch(error => {
  const secret = process.env.ODA_PILOT_DATABASE_URL;
  const message = error instanceof Error ? error.message : 'Falha no lote de revisão.';
  console.error(secret ? message.split(secret).join('[URL omitida]') : message);
  process.exitCode = 1;
});
