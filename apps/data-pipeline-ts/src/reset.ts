import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});
import { prisma } from "./common/database";

async function deleteAll() {
    await prisma.filaExtracaoGrupo.deleteMany({ where: { similares: { gt: 1} }})
    await prisma.filaExtracaoPesquisador.deleteMany({ where: { status: "CONCLUIDO"}})
} 

deleteAll()