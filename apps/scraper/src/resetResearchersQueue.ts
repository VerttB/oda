import { PrismaClient, prismaConfig, FilaExtracaoStatus } from '@oda/database';

const prisma = new PrismaClient(prismaConfig);

async function resetResearchersQueue() {
  console.log('[Fila Pesquisadores] Redefinindo PROCESSANDO -> PENDENTE...');

  const updatedPesquisadores = await prisma.filaExtracaoPesquisador.updateMany({
    where: { status: FilaExtracaoStatus.PROCESSANDO },
    data: {
      status: FilaExtracaoStatus.PENDENTE,
      processamentoIniciadoEm: null,
    },
  });

  console.log(`[Fila Pesquisadores] ${updatedPesquisadores.count} registros alterados.`);

  await prisma.$disconnect();
}

resetResearchersQueue().catch(async (err) => {
  console.error('[Fila Pesquisadores] Erro ao redefinir a fila:', err);
  await prisma.$disconnect();
  process.exit(1);
});
