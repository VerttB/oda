import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import { runDgpScraper } from "./scrapers/dgpScraper";
import { runDgpDiscovery } from "./scrapers/dgpDiscovery";
import { runLattesScraper } from "./scrapers/lattesScraper";
import { repopulateQueue } from "./scrapers/repopulateQueue";
import { prisma } from "./common/database";
import { FilaExtracaoStatus } from "@oda/database";


async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "dgp-extract";

  console.log(`[Pipeline] Iniciando Data Pipeline TS com comando: ${command}`);

  try {
    switch (command) {
      case "discovery":
      case "dgp-discovery":
        const keys = args.length > 1 ? args.slice(1) : ["a", "e", "i", "o", "u"];
        await runDgpDiscovery(keys);
        break;

      case "dgp":
      case "dgp-extract":
        const dgpIds = args.slice(1);
        await runDgpScraper(dgpIds);
        break;
      
      case "lattes":
      case "lattes-scraper":
        const names = args.slice(1);
        await runLattesScraper(names);
        break;
      
      case "repopulate":
      case "repopulate-researchers":
        await repopulateQueue();
        break;
      
      case "reset-queue":
        const updated = await prisma.filaExtracaoPesquisador.updateMany({
          where: { status: FilaExtracaoStatus.PROCESSANDO },
          data: {
            status: FilaExtracaoStatus.PENDENTE,
            processamentoIniciadoEm: null,
          }
        });
        console.log(`[Queue] Redefinidos ${updated.count} pesquisadores de PROCESSANDO para PENDENTE.`);
        break;
      
      default:
        console.error(`[Pipeline] Erro: Comando desconhecido '${command}'`);
        console.log("Comandos disponíveis: dgp-discovery, dgp-extract, lattes");
        process.exit(1);
    }
  } catch (error) {
    console.error("[Pipeline] Erro fatal na execução:", error);
    process.exit(1);
  }
}

main();
