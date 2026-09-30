import * as fs from 'fs';
import * as path from 'path';
import { FilaExtracaoStatus } from '@oda/database';
import { prisma } from './common/database';
import { LATTES_DATA_DIR } from './common/config';

const SAMPLE_LIMIT = 50;

async function checkPendingLattesRawFiles() {
  console.log(`[Fila Pesquisadores] Conferindo arquivos em: ${LATTES_DATA_DIR}`);

  const rawIds = new Set(
    fs.existsSync(LATTES_DATA_DIR)
      ? fs.readdirSync(LATTES_DATA_DIR)
          .filter((file) => file.endsWith('.json'))
          .map((file) => path.basename(file, '.json').trim())
          .filter(Boolean)
      : [],
  );

  const pendingResearchers = await prisma.filaExtracaoPesquisador.findMany({
    where: { status: FilaExtracaoStatus.PENDENTE },
    select: {
      lattesId: true,
      nome: true,
    },
    orderBy: { ultimaAtualizacao: 'asc' },
  });

  const pendingIds = new Set(pendingResearchers.map((item) => item.lattesId.trim()));
  const pendingWithRawFile = pendingResearchers.filter((item) => rawIds.has(item.lattesId.trim()));
  const rawFilesNotPending = Array.from(rawIds).filter((id) => !pendingIds.has(id));

  console.log(`[Fila Pesquisadores] Arquivos JSON encontrados: ${rawIds.size}`);
  console.log(`[Fila Pesquisadores] Pesquisadores PENDENTES no banco: ${pendingResearchers.length}`);
  console.log(`[Fila Pesquisadores] Pendentes que já possuem JSON raw: ${pendingWithRawFile.length}`);
  console.log(`[Fila Pesquisadores] JSONs raw que não estão como PENDENTE: ${rawFilesNotPending.length}`);

  if (pendingWithRawFile.length > 0) {
    console.log(`\n[Fila Pesquisadores] Amostra de PENDENTES com JSON raw, até ${SAMPLE_LIMIT}:`);
    for (const item of pendingWithRawFile.slice(0, SAMPLE_LIMIT)) {
      console.log(`- ${item.lattesId} | ${item.nome}`);
    }
  }

  if (rawFilesNotPending.length > 0) {
    console.log(`\n[Fila Pesquisadores] Amostra de JSONs raw fora de PENDENTE, até ${SAMPLE_LIMIT}:`);
    for (const id of rawFilesNotPending.slice(0, SAMPLE_LIMIT)) {
      console.log(`- ${id}`);
    }
  }
}

checkPendingLattesRawFiles()
  .catch((err) => {
    console.error('[Fila Pesquisadores] Erro ao conferir arquivos raw:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
