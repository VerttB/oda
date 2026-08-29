import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, prismaConfig, FilaExtracaoStatus } from '@oda/database';

const prisma = new PrismaClient(prismaConfig);

async function syncQueueWithFiles() {
  console.log('🔄 Sincronizando filas do banco com arquivos JSON em raw-data e processed-data...\n');

  const rootDataDir = path.resolve(__dirname, '../data');
  const rawDgpDir = path.join(rootDataDir, 'raw-data', 'dgp');
  const processedDgpDir = path.join(rootDataDir, 'processed-data', 'dgp');

  const rawLattesDir = path.join(rootDataDir, 'raw-data', 'lattes');
  const processedLattesDir = path.join(rootDataDir, 'processed-data', 'lattes');

  // 1. Sincronização da Fila de Grupos
  const pendingGroups = await prisma.filaExtracaoGrupo.findMany({
    where: { status: FilaExtracaoStatus.PENDENTE },
    select: { dgpId: true }
  });
  console.log(`🔍 [Grupos] Analisando ${pendingGroups.length} grupos com status PENDENTE...`);

  const groupsToComplete: string[] = [];
  for (const g of pendingGroups) {
    const fileName = `${g.dgpId.trim()}.json`;
    const inRaw = fs.existsSync(path.join(rawDgpDir, fileName));
    const inProcessed = fs.existsSync(path.join(processedDgpDir, fileName));

    if (inRaw || inProcessed) {
      groupsToComplete.push(g.dgpId);
    }
  }

  if (groupsToComplete.length > 0) {
    await prisma.filaExtracaoGrupo.updateMany({
      where: { dgpId: { in: groupsToComplete } },
      data: {
        status: FilaExtracaoStatus.CONCLUIDO,
        processamentoIniciadoEm: null,
        ultimoErroId: null,
        ultimoErroEm: null,
      }
    });
    console.log(`✅ [Grupos] ${groupsToComplete.length} grupos atualizados de PENDENTE -> CONCLUIDO.`);
  } else {
    console.log('ℹ️ [Grupos] Nenhum grupo pendente possuía arquivo JSON correspondente.');
  }

  // 2. Sincronização da Fila de Pesquisadores
  const pendingResearchers = await prisma.filaExtracaoPesquisador.findMany({
    where: { status: FilaExtracaoStatus.PENDENTE },
    select: { lattesId: true }
  });
  console.log(`\n🔍 [Pesquisadores] Analisando ${pendingResearchers.length} pesquisadores com status PENDENTE...`);

  const researchersToComplete: string[] = [];
  for (const r of pendingResearchers) {
    if (!r.lattesId) continue;
    const fileName = `${r.lattesId.trim()}.json`;
    const inRaw = fs.existsSync(path.join(rawLattesDir, fileName));
    const inProcessed = fs.existsSync(path.join(processedLattesDir, fileName));

    if (inRaw || inProcessed) {
      researchersToComplete.push(r.lattesId);
    }
  }

  if (researchersToComplete.length > 0) {
    await prisma.filaExtracaoPesquisador.updateMany({
      where: { lattesId: { in: researchersToComplete } },
      data: {
        status: FilaExtracaoStatus.CONCLUIDO,
        processamentoIniciadoEm: null,
        ultimoErroId: null,
        ultimoErroEm: null,
      }
    });
    console.log(`✅ [Pesquisadores] ${researchersToComplete.length} pesquisadores atualizados de PENDENTE -> CONCLUIDO.`);
  } else {
    console.log('ℹ️ [Pesquisadores] Nenhum pesquisador pendente possuía arquivo JSON correspondente.');
  }

  console.log('\n✨ Sincronização concluída com sucesso!');
  await prisma.$disconnect();
}

syncQueueWithFiles().catch((err) => {
  console.error('❌ Erro durante a sincronização:', err);
  process.exit(1);
});
