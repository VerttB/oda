import '../env';
import {
    createLattesScraperQueue, lattesJobId, validateScrapeLattesResearcherJob,
} from '@oda/queue';
import { FilaExtracaoStatus } from '@oda/database';
import { prisma } from '../../common/database';
import { SCRAPER_SETTINGS } from '../../common/config';
import { publishLattesBatch, reconcileLattesQueue } from './lattesDispatch';
import { LattesQueueRepository } from './lattesRepository';
import { runLattesWorker } from './lattesWorker';

function assertIds(ids: string[]) {
    const invalid = ids.find(id => !/^\d{16}$/.test(id));
    if (invalid) throw new Error(`ID Lattes invalido: ${invalid}. Use exatamente 16 digitos.`);
}

async function main() {
    const [command, ...ids] = process.argv.slice(2);
    if (!command || process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log('pnpm queue:prepare                         Compila fila e scraper');
        console.log('pnpm queue:lattes:enqueue [lattesId ...]   Publica IDs ou pesquisadores pendentes');
        console.log('pnpm queue:lattes:worker                   Inicia o consumidor Lattes');
        console.log('pnpm queue:lattes:status [lattesId]        Consulta contadores ou um job');
        console.log('pnpm queue:lattes:reconcile                Retoma publicacoes e sincroniza falhas');
        return;
    }
    if (!['enqueue', 'worker', 'status', 'reconcile'].includes(command)) throw new Error('Comando de fila desconhecido. Use --help.');
    assertIds(ids);
    if ((command === 'worker' || command === 'reconcile') && ids.length) throw new Error('Este comando nao recebe IDs.');
    if (command === 'status' && ids.length > 1) throw new Error('Consulte apenas um ID por vez.');

    const queue = createLattesScraperQueue();
    queue.on('error', error => console.error('[Lattes Queue] Redis:', error.message));
    const repository = new LattesQueueRepository(prisma);
    try {
        if (command === 'worker') { await runLattesWorker(queue, repository); return; }
        if (command === 'status') {
            console.log(await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'));
            if (ids[0]) {
                const job = await queue.getJob(lattesJobId(ids[0]));
                console.log(job ? {
                    id: job.id, estado: await job.getState(), progresso: job.progress,
                    tentativas: job.attemptsMade, erro: job.failedReason, resultado: job.returnvalue,
                    pipelineLogId: job.data.pipelineLogId,
                } : 'Job nao encontrado no Redis. O historico permanece no PostgreSQL.');
            }
            return;
        }
        await reconcileLattesQueue(queue, repository);
        if (command === 'reconcile') { console.log('[Lattes Queue] Reconciliacao concluida.'); return; }

        const rows = await prisma.filaExtracaoPesquisador.findMany({
            where: ids.length ? { lattesId: { in: [...new Set(ids)] } } : { status: FilaExtracaoStatus.PENDENTE },
            select: { lattesId: true, nome: true },
            take: ids.length ? undefined : SCRAPER_SETTINGS.lattes.take,
            orderBy: { lattesId: 'asc' },
        });
        if (ids.length && rows.length !== new Set(ids).size) {
            const found = new Set(rows.map(row => row.lattesId));
            throw new Error(`Pesquisadores inexistentes na fila SQL: ${[...new Set(ids)].filter(id => !found.has(id)).join(', ')}.`);
        }
        const available: Array<{ lattesId: string; nome: string }> = [];
        for (const row of rows) {
            const existing = await queue.getJob(lattesJobId(row.lattesId));
            if (existing) {
                const state = await existing.getState();
                if (state !== 'completed' && state !== 'failed') continue;
                validateScrapeLattesResearcherJob(existing.data);
                if (!await repository.result(existing.data)) throw new Error(`Reconcile o job ${existing.id} antes de republicar.`);
                await existing.remove();
            }
            available.push(row);
        }
        if (!available.length) { console.log('[Lattes Queue] Nenhum pesquisador novo para publicar.'); return; }
        const batch = await repository.createBatch(available);
        const count = await publishLattesBatch(batch, queue, repository);
        console.log('[Lattes Queue] Lote publicado.', { pipelineLogId: batch.id, pesquisadores: count, duplicados: available.length - count });
    } finally {
        await queue.close();
    }
}

main().catch(error => {
    console.error('[Lattes Queue]', error.message);
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
