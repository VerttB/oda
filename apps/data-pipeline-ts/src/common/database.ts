import { prismaConfig, PrismaClient } from '@oda/database';

export const prisma = new PrismaClient(prismaConfig)

export const db = {
  /**
   * Registra o início de uma nova coleta global.
   */
  async startColeta(origem: string) {
    return prisma.coletaScraper.create({
      data: {
        dataInicio: new Date(),
        dataFim: new Date(),
        status: 'EM_ANDAMENTO',
        registrosProcessados: 0,
        origem,
        logErros: '',
      },
    });
  },

  /**
   * Finaliza uma coleta global.
   */
  async finishColeta(id: string, registros: number, erros: string = '') {
    return prisma.coletaScraper.update({
      where: { id },
      data: {
        dataFim: new Date(),
        status: erros ? 'ERRO' : 'CONCLUIDA',
        registrosProcessados: registros,
        logErros: erros,
      },
    });
  },

  /**
   * Registra a descoberta ou início do processamento de um grupo específico.
   */
  async logGrupo(coletaId: string, grupoId: string, acao: 'INICIO' | 'FIM' | 'ERRO' = 'INICIO') {
    return prisma.logColetaGrupo.create({
      data: {
        coletaId,
        grupoId,
        acao: acao as any,
      },
    });
  },

  /**
   * Salva IDs descobertos na fila de extração.
   */
  async queueDiscovery(termoBusca: string) {
     return prisma.filaExtracao.upsert({
         where: { termoBusca },
         update: {},
         create: { termoBusca, status: 'PENDENTE' }
     });
  },

  /**
   * Atualiza o status de um item na fila.
   */
  async updateQueueStatus(termoBusca: string, status: string) {
      return prisma.filaExtracao.update({
          where: { termoBusca },
          data: { status }
      });
  }
};
