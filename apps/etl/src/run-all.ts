import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

import { PrismaClient, prismaConfig, SharedPipelineLogger, ModuloSistema, ModoExecucao, StatusSessao, StatusItemLog, TipoErroColeta, TipoEntidadeLog, PipelineEtapa } from '@oda/database';
import { saveGroupToDb } from './dgpEtl';
import { saveLattesToDb } from './lattesEtl';
import { PROCESSED_DATA_DIR } from './commom/config';

const prisma = new PrismaClient(prismaConfig);
const pipelineLogger = new SharedPipelineLogger(prisma);

async function runAll() {
    console.log("=== RUNNING ETL FOR ALL GROUPS AND RESEARCHERS ===");
    
    const dgpDir = path.join(PROCESSED_DATA_DIR, 'dgp');
    const lattesDir = path.join(PROCESSED_DATA_DIR, 'lattes');

    if (!fs.existsSync(dgpDir)) {
        console.error(`DGP directory not found: ${dgpDir}`);
        return;
    }

    const groupFiles = fs.readdirSync(dgpDir).filter(f => f.endsWith('.json'));
    console.log(`Found ${groupFiles.length} groups in processed-data.`);

    for (const groupFile of groupFiles) {
        const groupFilePath = path.join(dgpDir, groupFile);
        const dgpId = groupFile.replace('.json', '');
        console.log(`\n--------------------------------------------`);
        console.log(`[ETL-ALL] Processing Group: ${groupFile}`);
        
        const pipelineLogId = await pipelineLogger.startPipelineLogger(
          ModuloSistema.ETL,
          dgpId,
          ModoExecucao.COMPLETA
        );

        let groupData: any = {};
        let pesquisadoresContador = 0;
        let linhasContador = 0;

        try {
          groupData = JSON.parse(fs.readFileSync(groupFilePath, 'utf-8'));
          
          // 1. Process group
          const t0 = performance.now();
          await saveGroupToDb(groupData);
          const tempoGroupMs = Math.round(performance.now() - t0);

          if (groupData.linhas && Array.isArray(groupData.linhas)) {
            linhasContador = groupData.linhas.length;
          }

          await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_GRUPO_CARGA, StatusItemLog.SUCESSO, {
            entidadeId: dgpId,
            tipoEntidade: TipoEntidadeLog.GRUPO,
            tempoMs: tempoGroupMs,
          });
        } catch (err: any) {
          console.error(`[ETL-ALL] Erro ao carregar grupo ${dgpId}: ${err.message}`);
          await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_GRUPO_CARGA, StatusItemLog.ERRO, {
            entidadeId: dgpId,
            tipoEntidade: TipoEntidadeLog.GRUPO,
            tipoErro: TipoErroColeta.FALHA_ETL,
            mensagemErro: err.message,
            detalhesErro: err.stack,
          });
        }

        // 2. Process members
        if (groupData.membros && Array.isArray(groupData.membros)) {
            console.log(`[ETL-ALL] Group has ${groupData.membros.length} members. Checking files...`);
            for (const membro of groupData.membros) {
                if (!membro.lattes) continue;
                const lattesId = membro.lattes.trim();
                const lattesFileName = `${lattesId}.json`;
                const lattesFilePath = path.join(lattesDir, lattesFileName);

                if (fs.existsSync(lattesFilePath)) {
                    console.log(`[ETL-ALL] Processing Researcher Lattes: ${membro.nome} (${lattesId})`);
                    const tMembro = performance.now();
                    try {
                      const lattesData = JSON.parse(fs.readFileSync(lattesFilePath, 'utf-8'));
                      await saveLattesToDb(lattesData);
                      const tempoMembroMs = Math.round(performance.now() - tMembro);
                      pesquisadoresContador++;

                      await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.SUCESSO, {
                        entidadeId: lattesId,
                        tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                        tempoMs: tempoMembroMs,
                      });
                    } catch (mErr: any) {
                      console.error(`[ETL-ALL] Erro ao processar Lattes ${lattesId}: ${mErr.message}`);
                      await pipelineLogger.pipelineLogItem(pipelineLogId, PipelineEtapa.ETL_PESQUISADOR_CARGA, StatusItemLog.ERRO, {
                        entidadeId: lattesId,
                        tipoEntidade: TipoEntidadeLog.PESQUISADOR,
                        tipoErro: TipoErroColeta.FALHA_ETL,
                        mensagemErro: mErr.message,
                        detalhesErro: mErr.stack,
                      });
                    }
                } else {
                    console.log(`[ETL-ALL] Lattes file NOT found for: ${membro.nome} (${lattesId})`);
                }
            }
        }

        await pipelineLogger.finishPipelineLogger(pipelineLogId, StatusSessao.CONCLUIDO, {
          gruposGravados: 1,
          pesquisadoresAtualizados: pesquisadoresContador,
          linhasPesquisaGravadas: linhasContador,
        });
    }
    console.log("\n=== ETL RUN ALL COMPLETED ===");
}

runAll().catch(console.error);
