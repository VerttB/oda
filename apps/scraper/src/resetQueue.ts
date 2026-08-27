import { PrismaClient, prismaConfig, FilaExtracaoStatus } from '@oda/database';

const prisma = new PrismaClient(prismaConfig);

async function resetQueue() {
  console.log('🔄 Redefinindo status da fila de extração no PostgreSQL (PROCESSANDO -> PENDENTE)...');

  const updatedPesquisadores = await prisma.filaExtracaoPesquisador.updateMany({
    where: { status: FilaExtracaoStatus.PROCESSANDO },
    data: { status: FilaExtracaoStatus.PENDENTE }
  });

  const updatedGrupos = await prisma.filaExtracaoGrupo.updateMany({
    where: { status: FilaExtracaoStatus.PROCESSANDO },
    data: { status: FilaExtracaoStatus.PENDENTE }
  });

  console.log(`✅ [Fila Pesquisadores] ${updatedPesquisadores.count} registros alterados de PROCESSANDO -> PENDENTE.`);
  console.log(`✅ [Fila Grupos] ${updatedGrupos.count} registros alterados de PROCESSANDO -> PENDENTE.`);

  await prisma.$disconnect();
}

resetQueue().catch((err) => {
  console.error('❌ Erro ao redefinir a fila:', err);
  process.exit(1);
});
