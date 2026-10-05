import { createSystemQueue, enqueueBackupDb, enqueueRefreshMv, enqueueCleanupLogs, enqueueReconcileStuckQueues } from './systemQueue';
import { prisma } from '../common/database';

async function main() {
  const [command, ...rawArgs] = process.argv.slice(2);

  if (!command || process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('pnpm system:worker                    Inicia o worker de manutenção');
    console.log('pnpm system:cli enqueue backup              Publica job de backup');
    console.log('pnpm system:cli enqueue refresh-mv          Publica job de refresh MV');
    console.log('pnpm system:cli enqueue cleanup-logs        Publica job de limpeza de logs');
    console.log('pnpm system:cli enqueue reconcile-stuck     Publica job de reconciliação de filas presas');
    console.log('pnpm system:cli status                      Consulta contadores da fila');
    return;
  }

  if (!['worker', 'enqueue', 'status'].includes(command)) {
    throw new Error('Comando desconhecido. Use --help.');
  }

  const queue = createSystemQueue();

  queue.on('error', (error) => console.error('[System Queue] Redis:', error.message));

  try {
    if (command === 'worker') {
      const { runSystemWorker } = await import('./systemWorker.js');
      await runSystemWorker();
      return;
    }

    if (command === 'status') {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused');
      console.log('Contadores da fila:', counts);
      return;
    }

    const [subCommand, ...subArgs] = rawArgs;

    await Promise.resolve().then(async () => {
      if (subCommand === 'backup') {
        await enqueueBackupDb({ version: 1, requestedAt: new Date().toISOString(), format: 'custom', retentionDays: 7 }, queue);
        console.log('[System Queue] Job de backup enfileirado.');
      } else if (subCommand === 'refresh-mv') {
        await enqueueRefreshMv({ version: 1, requestedAt: new Date().toISOString(), concurrently: true }, queue);
        console.log('[System Queue] Job de refresh MV enfileirado.');
      } else if (subCommand === 'cleanup-logs') {
        await enqueueCleanupLogs({ version: 1, requestedAt: new Date().toISOString(), retentionDays: 30 }, queue);
        console.log('[System Queue] Job de limpeza de logs enfileirado.');
      } else if (subCommand === 'reconcile-stuck') {
        await enqueueReconcileStuckQueues({ version: 1, requestedAt: new Date().toISOString(), staleDays: 14 }, queue);
        console.log('[System Queue] Job de reconciliação de filas presas enfileirado.');
      } else {
        throw new Error('Subcomando desconhecido. Use backup, refresh-mv, cleanup-logs ou reconcile-stuck.');
      }
    });
  } finally {
    await queue.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[System CLI]', error.message);
  process.exitCode = 1;
});