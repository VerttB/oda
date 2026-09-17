import '../env';
import { createDiscoveryQueue, discoveryJobId, validateDiscoverDgpGroupsJob } from '@oda/queue';
import { prisma } from '../../common/database';
import { publishDiscoveryBatch, reconcileDiscoveryQueue } from './discoveryDispatch';
import { DiscoveryQueueRepository } from './discoveryRepository';
import { runDiscoveryWorker } from './discoveryWorker';

async function main() {
    const [command, ...keys] = process.argv.slice(2);
    if (!command || process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log('pnpm queue:prepare                         Compila fila e scraper');
        console.log('pnpm queue:discovery:enqueue [chave ...]   Publica chaves (padrao: a e i o u)');
        console.log('pnpm queue:discovery:worker                Inicia o consumidor de descoberta');
        console.log('pnpm queue:discovery:status [chave]        Consulta contadores ou um job');
        console.log('pnpm queue:discovery:reconcile             Retoma publicacoes e sincroniza falhas');
        return;
    }
    if (!['enqueue', 'worker', 'status', 'reconcile'].includes(command)) throw new Error('Comando de fila desconhecido. Use --help.');
    if ((command === 'worker' || command === 'reconcile') && keys.length) throw new Error('Este comando nao recebe chaves.');
    if (command === 'status' && keys.length > 1) throw new Error('Consulte apenas uma chave por vez.');

    const queue = createDiscoveryQueue();
    queue.on('error', error => console.error('[Discovery Queue] Redis:', error.message));
    const repository = new DiscoveryQueueRepository(prisma);
    try {
        if (command === 'worker') { await runDiscoveryWorker(queue, repository); return; }
        if (command === 'status') {
            console.log(await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'));
            if (keys[0]) {
                const job = await queue.getJob(discoveryJobId(keys[0]));
                console.log(job ? {
                    id: job.id, estado: await job.getState(), progresso: job.progress,
                    tentativas: job.attemptsMade, erro: job.failedReason, resultado: job.returnvalue,
                    pipelineLogId: job.data.pipelineLogId,
                } : 'Job nao encontrado no Redis. O historico permanece no PostgreSQL.');
            }
            return;
        }
        await reconcileDiscoveryQueue(queue, repository);
        if (command === 'reconcile') { console.log('[Discovery Queue] Reconciliacao concluida.'); return; }

        const candidates = keys.length ? keys : ['a', 'e', 'i', 'o', 'u'];
        const available: string[] = [];
        for (const chave of candidates) {
            if (!chave.trim() || chave.trim().length > 100) throw new Error('Cada chave deve conter entre 1 e 100 caracteres.');
            const existing = await queue.getJob(discoveryJobId(chave));
            if (existing) {
                const state = await existing.getState();
                if (state !== 'completed' && state !== 'failed') continue;
                validateDiscoverDgpGroupsJob(existing.data);
                if (!await repository.result(existing.data)) throw new Error(`Reconcile o job ${existing.id} antes de republicar.`);
                await existing.remove();
            }
            available.push(chave.trim());
        }
        if (!available.length) { console.log('[Discovery Queue] Nenhuma chave nova para publicar.'); return; }
        const batch = await repository.createBatch(available);
        const count = await publishDiscoveryBatch(batch, queue, repository);
        console.log('[Discovery Queue] Lote publicado.', { pipelineLogId: batch.id, chaves: count, duplicadas: available.length - count });
    } finally {
        await queue.close();
    }
}

main().catch(error => {
    console.error('[Discovery Queue]', error.message);
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
