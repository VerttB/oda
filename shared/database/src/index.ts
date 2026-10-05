import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClient } from '../generated/prisma';
export {
  PrismaClient,
  Prisma,
  FilaExtracaoStatus,
  Situacao,
  TipoRelacaoGrupoInstituicao,
  FormacaoAcademica,
  TipoPesquisador,
  TipoProducao,
  ModuloSistema,
  ModoExecucao,
  StatusSessao,
  PalavraChave,
  SetorAplicacao,
  GrupoPesquisa,
  Pesquisador,
  TipoAreaConhecimento,
  TipoRelacaoGrupoArea,
  MetodoInferenciaGrupoArea,
  MetodoMapeamentoAreaTaxonomia,
  StatusMapeamentoAreaTaxonomia,
  TipoRelacaoAreaTaxonomia,
  TipoOpenAlexAreaConhecimento,
  Qualis,
  RagSourceType,
  IndexingJobStatus,
  StatusColeta,
  TipoEntidadeLog,
  StatusItemLog,
  PipelineEtapa,
  TipoErroColeta,
} from '../generated/prisma';
export * from './pipelineLogger';
import path from "path";
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

export const prismaConfig = {
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
};