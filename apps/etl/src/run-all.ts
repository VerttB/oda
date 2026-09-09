import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import { DGP_DIR, LATTES_DIR } from './commom/config';
import { runGroupEtl } from './dgpEtl';
import { runPesquisadorEtl } from './lattesEtl';

async function runAll() {
    console.log("=== RUNNING ETL FOR ALL GROUPS AND RESEARCHERS ===");
    
    const groupFiles = fs.existsSync(DGP_DIR)
        ? fs.readdirSync(DGP_DIR).filter(f => f.endsWith('.json'))
        : [];
    const lattesFiles = fs.existsSync(LATTES_DIR)
        ? fs.readdirSync(LATTES_DIR).filter(f => f.endsWith('.json'))
        : [];

    console.log(`[ETL-ALL] Found ${groupFiles.length} group files in raw-data.`);
    console.log(`[ETL-ALL] Found ${lattesFiles.length} Lattes files in raw-data.`);

    console.log("\n=== ETL GROUPS FIRST ===");
    for (const groupFile of groupFiles) {
        const groupFilePath = path.join(DGP_DIR, groupFile);
        console.log(`\n[ETL-ALL] Processing Group: ${groupFile}`);
        await runGroupEtl(groupFilePath);
    }

    console.log("\n=== ETL RESEARCHERS AFTER GROUPS ===");
    for (const lattesFile of lattesFiles) {
        const lattesFilePath = path.join(LATTES_DIR, lattesFile);
        if (!fs.existsSync(lattesFilePath)) continue;

        console.log(`\n[ETL-ALL] Processing Researcher Lattes: ${lattesFile}`);
        await runPesquisadorEtl(lattesFilePath);
    }

    console.log("\n=== ETL RUN ALL COMPLETED ===");
}

runAll().catch(console.error);
