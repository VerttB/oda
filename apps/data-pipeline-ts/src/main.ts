import * as dotenv from "dotenv";
import { runDgpScraper } from "./scrapers/dgpScraper";
import { runLattesScraper } from "./scrapers/lattesScraper";

dotenv.config({ path: "../../.env" });

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "dgp";

  console.log(`[Pipeline] Iniciando Data Pipeline TS com comando: ${command}`);

  try {
    switch (command) {
      case "dgp":
      case "dgp-scraper":
        await runDgpScraper();
        break;
      
      case "lattes":
      case "lattes-scraper":
        // Passa os nomes fornecidos via CLI ou deixa vazio para o default
        const names = args.slice(1);
        await runLattesScraper(names);
        break;
      
      default:
        console.error(`[Pipeline] Erro: Comando desconhecido '${command}'`);
        console.log("Comandos disponíveis: dgp, lattes");
        process.exit(1);
    }
  } catch (error) {
    console.error("[Pipeline] Erro fatal na execução:", error);
    process.exit(1);
  }
}

main();
