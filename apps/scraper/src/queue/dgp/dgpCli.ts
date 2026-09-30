import '../env';
import { createDgpScraperQueue, DataScope, dgpJobId, parseDataScope, validateScrapeDgpGroupJob } from '@oda/queue';
import { FilaExtracaoStatus } from '@oda/database';
import { prisma } from '../../common/database';
import { assertValidDgpIds } from '../../common/dgpId';
import { SCRAPER_SETTINGS } from '../../common/config';
import { selectDgpRowsForScope } from '../../common/dgpScope';
import { DgpQueueRepository } from './dgpRepository';
import { publishBatch, reconcileDgpQueue } from './dgpDispatch';
import { runDgpWorker } from './dgpWorker';

function parseArgs(args: string[]) {
    let scope: DataScope = 'default';
    const positional: string[] = [];
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--scope') scope = parseDataScope(args[++index]);
        else if (arg.startsWith('--scope=')) scope = parseDataScope(arg.slice('--scope='.length));
        else positional.push(arg);
    }
    return { scope, positional };
}

async function main() {
    const [command, ...rawArgs] = process.argv.slice(2);
    const { scope, positional: ids } = parseArgs(rawArgs);
    if (!command || process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log('pnpm queue:prepare                  Compila fila e scraper');
        console.log('pnpm queue:dgp:enqueue [idDgp ...]                  Publica IDs ou pendentes ate o take');
        console.log('pnpm queue:dgp:enqueue --scope simcc [idDgp ...]    Publica todos os grupos SIMCC');
        console.log('pnpm queue:dgp:worker              Inicia o consumidor DGP');
        console.log('pnpm queue:dgp:status [idDgp]       Consulta contadores ou um job');
        console.log('pnpm queue:dgp:reconcile           Retoma publicacoes e sincroniza falhas');
        return;
    }
    if (!['enqueue', 'worker', 'status', 'reconcile'].includes(command)) throw new Error('Comando de fila desconhecido. Use --help.');
    assertValidDgpIds(ids);
    if (command !== 'enqueue' && scope !== 'default') throw new Error('--scope so pode ser usado ao enfileirar grupos.');
    if ((command === 'worker' || command === 'reconcile') && (ids.length || scope !== 'default')) throw new Error('Este comando nao recebe IDs nem escopo.');
    if (command === 'status' && ids.length > 1) throw new Error('Consulte apenas um ID por vez.');

    const queue = createDgpScraperQueue();
    queue.on('error', error => console.error('[DGP Queue] Redis:', error.message));
    const repository = new DgpQueueRepository(prisma);
    try {
        if (command === 'worker') { await runDgpWorker(queue, repository); return; }
        if (command === 'status') {
            console.log(await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'));
            if (ids[0]) {
                const job = await queue.getJob(dgpJobId(ids[0]));
                console.log(job ? { id: job.id, estado: await job.getState(), progresso: job.progress,
                    tentativas: job.attemptsMade, erro: job.failedReason, resultado: job.returnvalue, pipelineLogId: job.data.pipelineLogId }
                    : 'Job nao encontrado no Redis. O historico permanece no PostgreSQL.');
            }
            return;
        }
        await reconcileDgpQueue(queue, repository);
        if (command === 'reconcile') { console.log('[DGP Queue] Reconciliacao concluida.'); return; }

        const sourceRows = await prisma.filaExtracaoGrupo.findMany({
            where: ids.length
                ? { dgpId: { in: [...new Set(ids)] } }
                : scope === 'simcc'
                    ? {}
                    : { status: FilaExtracaoStatus.PENDENTE },
            select: { dgpId: true, instituicao: true }, orderBy: { dgpId: 'asc' },
        });
        if (ids.length && sourceRows.length !== new Set(ids).size) {
            const found = new Set(sourceRows.map(row => row.dgpId));
            const missing = [...new Set(ids)].filter(id => !found.has(id));
            if (scope === 'simcc') throw new Error(`IDs sem instituicao conhecida na fila de descoberta: ${missing.join(', ')}.`);
            await Promise.all(missing.map(dgpId => prisma.filaExtracaoGrupo.create({
                data: { dgpId, nome: `Grupo_${dgpId}`, area: 'N/A', instituicao: 'N/A' },
            })));
            sourceRows.push(...missing.map(dgpId => ({ dgpId, instituicao: 'N/A' })));
        }
        const candidates = selectDgpRowsForScope(
            sourceRows,
            scope,
            ids.length ? undefined : SCRAPER_SETTINGS.dgp.take,
        )
            .map(row => row.dgpId);
        if (scope === 'simcc' && ids.length && candidates.length !== new Set(ids).size) {
            throw new Error('Todos os IDs explicitos do escopo SIMCC devem pertencer a uma das 11 instituicoes reconhecidas.');
        }
        const available: string[] = [];
        for (const dgpId of candidates) {
            const existing = await queue.getJob(dgpJobId(dgpId));
            if (existing) {
                const state = await existing.getState();
                if (state !== 'completed' && state !== 'failed') continue;
                // Mantem o historico SQL antes de liberar o ID Redis para uma nova coleta.
                validateScrapeDgpGroupJob(existing.data);
                if (!await repository.result(existing.data)) throw new Error(`Reconcile o job ${existing.id} antes de republicar.`);
                await existing.remove();
            }
            available.push(dgpId);
        }
        if (!available.length) { console.log('[DGP Queue] Nenhum grupo disponivel para publicar.'); return; }
        const batch = await repository.createBatch(available, scope);
        const count = await publishBatch(batch, queue, repository);
        console.log('[DGP Queue] Lote publicado.', { pipelineLogId: batch.id, scope, grupos: count, duplicados: available.length - count });
    } finally {
        await queue.close();
    }
}

main().catch(error => {
    console.error('[DGP Queue]', error.message);
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
