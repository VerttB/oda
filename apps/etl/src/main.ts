import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});
import { DGP_DIR, LATTES_DIR } from './commom/config';
import { runGroupEtl, saveGroupToDb } from './dgpEtl';
import { runPesquisadorEtl, saveLattesToDb } from './lattesEtl';


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
        
        const content = fs.readFileSync(filePath, 'utf-8');
        try {
            const data = JSON.parse(content);
            if (filePath.includes('dgp')) {
                saveGroupToDb(data);
            } else if (filePath.includes('lattes')) {
                saveLattesToDb(data);
            }
        } catch (e) {
            console.error(`[ETL] Arquivo corrompido: ${filePath}`);
        }
    });

    console.log('[ETL] Modo Watcher ativo. Aguardando arquivos...');
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        startWatcher();
        return;
    }

    try {
        switch (command) {
            case 'grupo':
            case 'group': {
                const jsonPath = args[1];
                if (!jsonPath) {
                    console.error("Erro: Caminho do arquivo JSON do grupo não especificado.");
                    console.log("Uso: pnpm start grupo <caminho_do_json>");
                    process.exit(1);
                }
                await runGroupEtl(jsonPath);
                break;
            }
            case 'pesquisador':
            case 'lattes': {
                const jsonPath = args[1];
                if (!jsonPath) {
                    console.error("Erro: Caminho do arquivo JSON do pesquisador não especificado.");
                    console.log("Uso: pnpm start pesquisador <caminho_do_json>");
                    process.exit(1);
                }
                await runPesquisadorEtl(jsonPath);
                break;
            }
            default:
                console.error(`Erro: Comando desconhecido '${command}'`);
                console.log("Comandos disponíveis: grupo, pesquisador");
                process.exit(1);
        }
    } catch (error: any) {
        console.error("❌ Erro fatal durante a execução do ETL:", error.message);
        process.exit(1);
    }
}

main();
