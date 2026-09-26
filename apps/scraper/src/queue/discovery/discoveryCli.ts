import '../env';
import { createDiscoveryQueue, discoveryJobId, validateDiscoverDgpGroupsJob } from '@oda/queue';
import { prisma } from '../../common/database';
import { publishDiscoveryBatch, reconcileDiscoveryQueue } from './discoveryDispatch';
import { DiscoveryQueueRepository } from './discoveryRepository';
import { DiscoveryTarget, parseDiscoveryTerritoryArguments } from './discoveryTerritory';
import { runDiscoveryWorker } from './discoveryWorker';

async function main() {
    const [command, ...args] = process.argv.slice(2);
    if (!command || process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log('pnpm queue:prepare                         Compila fila e scraper');
        console.log('pnpm queue:discovery:enqueue [opcoes] [chave ...]');
        console.log('  --estados BA,PE       Publica para UFs especificas (padrao: BA)');
        console.log('  --regiao nordeste     Publica para todos os estados da regiao');
        console.log('  --brasil              Publica para as 27 UFs');
        console.log('  --dry-run             Mostra a expansao sem acessar Redis ou banco');
        console.log('pnpm queue:discovery:worker                Inicia o consumidor de descoberta');
        console.log('pnpm queue:discovery:status [chave] [--estado UF]');
        console.log('pnpm queue:discovery:reconcile             Retoma publicacoes e sincroniza falhas');
        return;
    }
    if (!['enqueue', 'worker', 'status', 'reconcile'].includes(command)) throw new Error('Comando de fila desconhecido. Use --help.');
    if ((command === 'worker' || command === 'reconcile') && args.length) throw new Error('Este comando nao recebe opcoes ou chaves.');

    const parsed = command === 'enqueue'
        ? parseDiscoveryTerritoryArguments(args)
        : command === 'status'
            ? parseDiscoveryTerritoryArguments(args, { defaultKeys: false })
            : null;
    if (command === 'status' && (parsed!.chaves.length > 1 || parsed!.ufs.length > 1)) {
        throw new Error('Consulte apenas uma combinacao de chave e UF por vez.');
    }
    if (command === 'enqueue' && parsed!.dryRun) {
        console.log('[Discovery Queue] Simulacao territorial.', {
            abrangencia: parsed!.abrangencia,
            ufs: parsed!.ufs,
            chaves: parsed!.chaves,
            jobs: parsed!.targets.length,
        });
        return;
    }

    const queue = createDiscoveryQueue();
    queue.on('error', error => console.error('[Discovery Queue] Redis:', error.message));
    const repository = new DiscoveryQueueRepository(prisma);
    try {
        if (command === 'worker') { await runDiscoveryWorker(queue, repository); return; }
        if (command === 'status') {
            console.log(await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'));
            if (parsed!.chaves[0]) {
                const uf = parsed!.ufs[0];
                let job = await queue.getJob(discoveryJobId(parsed!.chaves[0], uf));
                if (!job && uf === 'BA') job = await queue.getJob(discoveryJobId(parsed!.chaves[0]));
                console.log(job ? {
                    id: job.id, estado: await job.getState(), progresso: job.progress,
                    tentativas: job.attemptsMade, erro: job.failedReason, resultado: job.returnvalue,
                    pipelineLogId: job.data.pipelineLogId, uf: job.data.uf ?? 'BA',
                } : 'Job nao encontrado no Redis. O historico permanece no PostgreSQL.');
            }
            return;
        }
        await reconcileDiscoveryQueue(queue, repository);
        if (command === 'reconcile') { console.log('[Discovery Queue] Reconciliacao concluida.'); return; }

        const available: DiscoveryTarget[] = [];
        for (const target of parsed!.targets) {
            let existing = await queue.getJob(discoveryJobId(target.chave, target.uf));
            if (!existing && target.uf === 'BA') existing = await queue.getJob(discoveryJobId(target.chave));
            if (existing) {
                const state = await existing.getState();
                if (state !== 'completed' && state !== 'failed') continue;
                validateDiscoverDgpGroupsJob(existing.data);
                if (!await repository.result(existing.data)) throw new Error(`Reconcile o job ${existing.id} antes de republicar.`);
                await existing.remove();
            }
            available.push(target);
        }
        if (!available.length) { console.log('[Discovery Queue] Nenhum job territorial novo para publicar.'); return; }
        const batch = await repository.createBatch(available, parsed!.abrangencia);
        const count = await publishDiscoveryBatch(batch, queue, repository);
        console.log('[Discovery Queue] Lote publicado.', {
            pipelineLogId: batch.id,
            abrangencia: parsed!.abrangencia,
            ufs: parsed!.ufs.length,
            chaves: parsed!.chaves.length,
            jobs: count,
            duplicados: available.length - count,
        });
    } finally {
        await queue.close();
    }
}

main().catch(error => {
    console.error('[Discovery Queue]', error.message);
    process.exitCode = 1;
}).finally(() => prisma.$disconnect());
