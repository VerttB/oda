import { ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog } from '../generated/prisma';
import { PipelineMetadata, PipelineMetadataSchema } from '@oda/shared-types';

export interface LogItemOptions {
  entidadeId?: string;
  tipoEntidade?: TipoEntidadeLog;
  tipoErro?: TipoErroColeta;
  mensagemErro?: string;
  detalhesErro?: string;
  tempoMs?: number;
}

export class SharedPipelineLogger {
  constructor(private readonly prisma: any) {}

  /**
   * Cria uma nova sessão no pipeline_log
   */
  async startSession(
    modulo: ModuloSistema,
    dgpId?: string,
    modoExecucao: ModoExecucao = ModoExecucao.COMPLETA,
    metadata?: PipelineMetadata
  ): Promise<string | null> {
    try {
      const parsedMetadata = metadata ? PipelineMetadataSchema.optional().parse(metadata) : undefined;
      const log = await this.prisma.pipelineLog.create({
        data: {
          modulo,
          dgpId: dgpId || null,
          modoExecucao,
          status: StatusSessao.EMANDAMENTO,
          dataInicio: new Date(),
          metadata: parsedMetadata ? (parsedMetadata as any) : undefined,
        },
      });
      return log.id;
    } catch (err: any) {
      console.error(`[SharedPipelineLogger] Erro ao iniciar sessão: ${err.message}`);
      return null;
    }
  }

  /**
   * Registra um item/etapa individual no pipeline_log_item
   */
  async logItem(
    pipelineLogId: string | null,
    etapa: string,
    status: StatusItemLog,
    options?: LogItemOptions
  ) {
    if (!pipelineLogId) return;

    try {
      await this.prisma.pipelineLogItem.create({
        data: {
          pipelineLogId,
          etapa,
          status,
          entidadeId: options?.entidadeId || null,
          tipoEntidade: options?.tipoEntidade || TipoEntidadeLog.GRUPO,
          tipoErro: options?.tipoErro || null,
          mensagemErro: options?.mensagemErro || null,
          detalhesErro: options?.detalhesErro || null,
          tempoMs: options?.tempoMs || null,
        },
      });

      const incrementData = status === StatusItemLog.SUCESSO
        ? { registrosProcessados: { increment: 1 }, quantidadeSucessos: { increment: 1 } }
        : { registrosProcessados: { increment: 1 }, quantidadeErros: { increment: 1 } };

      await this.prisma.pipelineLog.update({
        where: { id: pipelineLogId },
        data: incrementData,
      });
    } catch (err: any) {
      console.error(`[SharedPipelineLogger] Erro ao gravar item: ${err.message}`);
    }
  }

  /**
   * Finaliza a sessão atualizando dataFim, duracaoMs, status e metadados finais
   */
  async finishSession(
    pipelineLogId: string | null,
    status: StatusSessao,
    finalMetadata?: PipelineMetadata
  ) {
    if (!pipelineLogId) return;

    try {
      const sessao = await this.prisma.pipelineLog.findUnique({
        where: { id: pipelineLogId },
      });

      if (!sessao) return;

      const dataFim = new Date();
      const duracaoMs = dataFim.getTime() - new Date(sessao.dataInicio).getTime();

      const existingMeta = (sessao.metadata as any) || {};
      const newMeta = finalMetadata ? (PipelineMetadataSchema.optional().parse(finalMetadata) as any) : {};
      const mergedMetadata = { ...existingMeta, ...newMeta };

      await this.prisma.pipelineLog.update({
        where: { id: pipelineLogId },
        data: {
          status,
          dataFim,
          duracaoMs,
          metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
        },
      });
    } catch (err: any) {
      console.error(`[SharedPipelineLogger] Erro ao finalizar sessão: ${err.message}`);
    }
  }
}
