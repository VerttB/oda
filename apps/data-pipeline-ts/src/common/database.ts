import { PrismaClient, prismaConfig } from "@oda/database"
import { FilaExtracaoStatus, StatusColeta, LogColetaStatus, LogColetaEntidade } from "@oda/database";
import { cleanStr } from "./utils";
export const prisma = new PrismaClient(prismaConfig)



export const db = {
  /**
   * Registra o início de uma nova coleta do scrapper principal.
   */
  async startScrapperColeta(origem: string) {
    return prisma.coletaScraper.create({
      data: {
        dataInicio: new Date(),
        status: StatusColeta.EMANDAMENTO,
        registrosProcessados: 0,
      },
    });
  },

  async getQueueDiscovery(){
    return prisma.filaExtracaoGrupo.findMany( { select: {
      nome: true,
      instituicao: true,
      area: true
    }})
  },

  /**
   * Normaliza os dados da fila existentes e atualiza a coluna similares.
   */
  async normalizeQueueData() {
    const allItems = await prisma.filaExtracaoGrupo.findMany();
    let updatedCount = 0;
    for (const item of allItems) {
        const cleanNome = cleanStr(item.nome);
        const cleanArea = cleanStr(item.area);
        const cleanInstituicao = cleanStr(item.instituicao);
        
        if (cleanNome !== item.nome || cleanArea !== item.area || cleanInstituicao !== item.instituicao) {
            await prisma.filaExtracaoGrupo.update({
                where: { dgpId: item.dgpId },
                data: {
                    nome: cleanNome,
                    area: cleanArea,
                    instituicao: cleanInstituicao
                }
            });
            item.nome = cleanNome;
            item.area = cleanArea;
            item.instituicao = cleanInstituicao;
            updatedCount++;
        }
    }
    if (updatedCount > 0) {
        console.log(`[Database] Normalizadas strings de ${updatedCount} registros no banco.`);
    }

    const itemsAfterNormalization = await prisma.filaExtracaoGrupo.findMany();
    const groupsMap = new Map<string, string[]>();
    for (const item of itemsAfterNormalization) {
        const key = `${item.nome}|${item.area}|${item.instituicao}`;
        if (!groupsMap.has(key)) {
            groupsMap.set(key, []);
        }
        groupsMap.get(key)!.push(item.dgpId);
    }

    let updatedSimilares = 0;
    for (const [_, dgpIds] of groupsMap.entries()) {
        const count = dgpIds.length;
        const sampleItem = itemsAfterNormalization.find(i => i.dgpId === dgpIds[0]);
        if (sampleItem && sampleItem.similares !== count) {
            await prisma.filaExtracaoGrupo.updateMany({
                where: { dgpId: { in: dgpIds } },
                data: { similares: count }
            });
            updatedSimilares += dgpIds.length;
        }
    }
    if (updatedSimilares > 0) {
        console.log(`[Database] Recalculado 'similares' para ${updatedSimilares} registros no banco.`);
    }
  },
  /**
   * Finaliza uma coleta global.
   */
  async finishColeta(id: string, registros: number) {
    return prisma.coletaScraper.update({
      where: { id },
      data: {
        dataFim: new Date(),
        status: StatusColeta.CONCLUIDA,
        registrosProcessados: registros,
      },
    });
  },

  /**
   * Registra a descoberta ou início do processamento de um grupo específico.
   */
  async logGrupo(coletaId: string, entidadeId: string,entidade: LogColetaEntidade, status: LogColetaStatus ) {
    return prisma.logColetaItem.create({
      data: {
        coletaId,
        entidadeId,
        entidade,
        status,
      },
    });
  },

  
  async queueDiscovery(data: { dgpId: string, nome: string, area: string, instituicao: string }) {
    const nomeLimpo = cleanStr(data.nome);
    const areaLimpa = cleanStr(data.area);
    const instituicaoLimpa = cleanStr(data.instituicao);

    return prisma.filaExtracaoGrupo.upsert({
      where: { dgpId: data.dgpId },
      update: { 
        nome: nomeLimpo,
        area: areaLimpa,
        instituicao: instituicaoLimpa
      },
      create: { 
        dgpId: data.dgpId, 
        nome: nomeLimpo,
        area: areaLimpa,
        instituicao: instituicaoLimpa,
        status: FilaExtracaoStatus.PENDENTE,
        similares: 1
      }
    });
  },

  /**
   * Atualiza o status de um item na fila.
   */
  async updateQueueStatus(dgpId: string, status: FilaExtracaoStatus) {
      return prisma.filaExtracaoGrupo.update({
          where: { dgpId },
          data: { status }
      });
  }
};
