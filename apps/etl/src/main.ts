import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});
import { DGP_DIR, getEtlDataPaths, LATTES_DIR, PROCESSED_DATA_DIR } from './commom/config';
import { runGroupEtl, saveGroupToDb } from './dgpEtl';
import { runPesquisadorEtl, saveLattesToDb } from './lattesEtl';
import { runFixMetadata } from './fixMetadata';
import { DataScope, parseDataScope } from '@oda/queue';


console.log('---------------------------------------------------------');
console.log('🚀 Serviço de ETL Open DGP (TypeScript)');
console.log('---------------------------------------------------------');

function startWatcher() {
    const watcher = chokidar.watch([DGP_DIR, LATTES_DIR], {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        awaitWriteFinish: true
    });

    watcher.on('add', (filePath) => {
        if (!filePath.endsWith('.json')) return;

        const task = filePath.includes('dgp')
            ? runGroupEtl(filePath)
            : filePath.includes('lattes')
                ? runPesquisadorEtl(filePath)
                : null;
        void task?.catch((error: unknown) => {
            console.error(`[ETL] Erro ao processar arquivo no watcher ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        });
    });

    console.log('[ETL] Modo Watcher ativo. Aguardando arquivos...');
}

function parseScopeArgs(args: string[]) {
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

function findGroupFile(idOrPath: string, scope: DataScope = 'default'): string {
    if (fs.existsSync(idOrPath) && fs.statSync(idOrPath).isFile()) {
        return path.resolve(idOrPath);
    }
    const fileName = idOrPath.endsWith('.json') ? idOrPath : `${idOrPath}.json`;
    const paths = getEtlDataPaths(scope);
    const rawPath = path.join(paths.dgpDir, fileName);
    if (fs.existsSync(rawPath)) return rawPath;
    const processedPath = path.join(paths.processedDataDir, 'dgp', fileName);
    if (fs.existsSync(processedPath)) return processedPath;
    throw new Error(`Arquivo de grupo não encontrado para o ID ou Caminho: "${idOrPath}"`);
}

function findLattesFile(idOrPath: string): string {
    if (fs.existsSync(idOrPath) && fs.statSync(idOrPath).isFile()) {
        return path.resolve(idOrPath);
    }
    const fileName = idOrPath.endsWith('.json') ? idOrPath : `${idOrPath}.json`;
    const rawPath = path.join(LATTES_DIR, fileName);
    if (fs.existsSync(rawPath)) return rawPath;
    const processedPath = path.join(PROCESSED_DATA_DIR, 'lattes', fileName);
    if (fs.existsSync(processedPath)) return processedPath;
    throw new Error(`Arquivo de currículo Lattes não encontrado para o ID ou Caminho: "${idOrPath}"`);
}

async function main() {
    const [command, ...rawArgs] = process.argv.slice(2);
    const { scope, positional: args } = parseScopeArgs(rawArgs);

    if (!command) {
        startWatcher();
        return;
    }

    try {
        switch (command) {
            case 'grupo':
            case 'group': {
                const idOrPath = args[0];
                if (!idOrPath) {
                    console.error("Erro: ID DGP ou Caminho do arquivo JSON do grupo não especificado.");
                    console.log("Uso: pnpm start grupo [--scope simcc] <id_dgp_ou_caminho>");
                    process.exit(1);
                }
                const resolvedPath = findGroupFile(idOrPath, scope);
                await runGroupEtl(resolvedPath, scope);
                break;
            }
            case 'pesquisador':
            case 'lattes': {
                if (scope === 'simcc') throw new Error('O escopo SIMCC processa apenas grupos.');
                const idOrPath = args[0];
                if (!idOrPath) {
                    console.error("Erro: ID Lattes ou Caminho do arquivo JSON do pesquisador não especificado.");
                    console.log("Uso: pnpm start pesquisador <id_lattes_ou_caminho>");
                    process.exit(1);
                }
                const resolvedPath = findLattesFile(idOrPath);
                await runPesquisadorEtl(resolvedPath);
                break;
            }
            case 'fix':
            case 'fix-metadata': {
                if (scope === 'simcc') throw new Error('O escopo SIMCC nao se aplica ao comando fix.');
                await runFixMetadata(args);
                break;
            }
            default:
                console.error(`Erro: Comando desconhecido '${command}'`);
                console.log("Comandos disponíveis: grupo, pesquisador, fix");
                process.exit(1);
        }
    } catch (error: any) {
        console.error("❌ Erro fatal durante a execução do ETL:", error.message);
        process.exit(1);
    }
}

main();
