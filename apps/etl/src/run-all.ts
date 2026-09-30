import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import { getEtlDataPaths } from './commom/config';
import { runGroupEtl } from './dgpEtl';
import { runPesquisadorEtl } from './lattesEtl';
import { DataScope, parseDataScope } from '@oda/queue';

function readScope(args: string[]): DataScope {
    if (!args.length) return 'default';
    if (args.length === 2 && args[0] === '--scope') return parseDataScope(args[1]);
    if (args.length === 1 && args[0].startsWith('--scope=')) return parseDataScope(args[0].slice('--scope='.length));
    throw new Error('Uso: pnpm etl [--scope simcc]');
}

async function runAll() {
    const scope = readScope(process.argv.slice(2));
    const { dgpDir, lattesDir } = getEtlDataPaths(scope);
    console.log("=== RUNNING ETL FOR ALL GROUPS AND RESEARCHERS ===");
    
    const groupFiles = fs.existsSync(dgpDir)
        ? fs.readdirSync(dgpDir).filter(f => f.endsWith('.json'))
        : [];
    const lattesFiles = scope === 'default' && fs.existsSync(lattesDir)
        ? fs.readdirSync(lattesDir).filter(f => f.endsWith('.json'))
        : [];

    console.log(`[ETL-ALL] Found ${groupFiles.length} group files in raw-data.`);
    console.log(`[ETL-ALL] Found ${lattesFiles.length} Lattes files in raw-data.`);

    let failures = 0;
    console.log("\n=== ETL GROUPS FIRST ===");
    for (const groupFile of groupFiles) {
        const groupFilePath = path.join(dgpDir, groupFile);
        console.log(`\n[ETL-ALL] Processing Group: ${groupFile}`);
        try {
            await runGroupEtl(groupFilePath, scope);
        } catch (error) {
            failures += 1;
            console.error(`[ETL-ALL] Group ${groupFile} failed:`, error instanceof Error ? error.message : error);
        }
    }

    console.log("\n=== ETL RESEARCHERS AFTER GROUPS ===");
    for (const lattesFile of lattesFiles) {
        const lattesFilePath = path.join(lattesDir, lattesFile);
        if (!fs.existsSync(lattesFilePath)) continue;

        console.log(`\n[ETL-ALL] Processing Researcher Lattes: ${lattesFile}`);
        try {
            await runPesquisadorEtl(lattesFilePath);
        } catch (error) {
            failures += 1;
            console.error(`[ETL-ALL] Researcher ${lattesFile} failed:`, error instanceof Error ? error.message : error);
        }
    }

    console.log(`\n=== ETL RUN ALL COMPLETED (${failures} failures) ===`);
    if (failures) process.exitCode = 1;
}

runAll().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
