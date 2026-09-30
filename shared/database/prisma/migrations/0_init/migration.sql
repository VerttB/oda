-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "tipo_relacao_grupo_instituicao" AS ENUM ('sede', 'parceira');

-- CreateEnum
CREATE TYPE "situacao" AS ENUM ('certificado', 'inativo', 'em_analise', 'em_preenchimento', 'excluido', 'aguardando_certificacao');

-- CreateEnum
CREATE TYPE "tipo_pesquisador" AS ENUM ('tecnico', 'estudante', 'pesquisador', 'colaborador_estrangeiro');

-- CreateEnum
CREATE TYPE "formacao_academica" AS ENUM ('graduacao', 'especializacao', 'mestrado', 'doutorado', 'outro');

-- CreateEnum
CREATE TYPE "tipo_area_conhecimento" AS ENUM ('GRANDE_AREA', 'AREA', 'SUBAREA', 'TOPICO');

-- CreateEnum
CREATE TYPE "tipo_open_alex_area_conhecimento" AS ENUM ('DOMAIN', 'FIELD', 'SUBFIELD', 'TOPIC');

-- CreateEnum
CREATE TYPE "tipo_relacao_area_taxonomia" AS ENUM ('EQUIVALENTE', 'OPENALEX_MAIS_AMPLO', 'OPENALEX_MAIS_ESPECIFICO', 'RELACIONADO');

-- CreateEnum
CREATE TYPE "metodo_mapeamento_area_taxonomia" AS ENUM ('MANUAL', 'TEXTO_NORMALIZADO');

-- CreateEnum
CREATE TYPE "status_mapeamento_area_taxonomia" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "tipo_relacao_grupo_area" AS ENUM ('PRINCIPAL', 'ADICIONAL');

-- CreateEnum
CREATE TYPE "metodo_inferencia_grupo_area" AS ENUM ('DGP', 'IA', 'MANUAL');

-- CreateEnum
CREATE TYPE "tipo_producao" AS ENUM ('artigo', 'livro_capitulo', 'outra');

-- CreateEnum
CREATE TYPE "qualis_estrato" AS ENUM ('A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C');

-- CreateEnum
CREATE TYPE "rag_source_type" AS ENUM ('grupo_pesquisa', 'linha_pesquisa', 'pesquisador', 'producao', 'area_conhecimento');

-- CreateEnum
CREATE TYPE "indexing_job_status" AS ENUM ('pendente', 'em_andamento', 'concluido', 'erro');

-- CreateEnum
CREATE TYPE "status_coleta" AS ENUM ('em_andamento', 'concluida');

-- CreateEnum
CREATE TYPE "ModuloSistema" AS ENUM ('SCRAPER', 'ETL', 'RAG');

-- CreateEnum
CREATE TYPE "ModoExecucao" AS ENUM ('COMPLETA', 'APENAS_DGP', 'APENAS_LATTES');

-- CreateEnum
CREATE TYPE "StatusSessao" AS ENUM ('EMANDAMENTO', 'CONCLUIDO', 'ERRO');

-- CreateEnum
CREATE TYPE "TipoEntidadeLog" AS ENUM ('GRUPO', 'PESQUISADOR', 'LINHA_PESQUISA', 'GERAL');

-- CreateEnum
CREATE TYPE "StatusItemLog" AS ENUM ('SUCESSO', 'ERRO');

-- CreateEnum
CREATE TYPE "pipeline_etapa" AS ENUM ('RH_DETALHES', 'INSTITUICOES_PARCEIRAS', 'LINHA_PESQUISA', 'GRUPO_ESPELHO', 'scrapeGroupPage', 'PESQUISADOR_LATTES', 'DGP_DISCOVERY', 'DGP_DISCOVERY_PAGINA', 'DGP_DISCOVERY_ITEM', 'ETL_GRUPO_CARGA', 'ETL_PESQUISADOR_CARGA');

-- CreateEnum
CREATE TYPE "TipoErroColeta" AS ENUM ('TIMEOUT', 'NAO_ENCONTRADO', 'BLOCKED_CAPTCHA', 'ESTRUTURA_HTML_INVALIDA', 'ERRO_REDE', 'FALHA_ETL', 'EMBEDDING_RATE_LIMIT', 'EMBEDDING_API_KEY_INVALIDA', 'EMBEDDING_FALHA_CALCULO', 'EMBEDDING_CONEXAO_LLM', 'DESCONHECIDO');

-- CreateEnum
CREATE TYPE "FilaExtracaoStatus" AS ENUM ('PENDENTE', 'CONCLUIDO', 'PROCESSANDO', 'ERRO');

-- CreateTable
CREATE TABLE "instituicao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "estado_id" TEXT,
    "image_url" TEXT,

    CONSTRAINT "instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_pesquisa_instituicao" (
    "grupo_id" TEXT NOT NULL,
    "instituicao_id" TEXT NOT NULL,
    "tipo_relacao" "tipo_relacao_grupo_instituicao" NOT NULL,
    "unidade" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "unidade_uf" TEXT,

    CONSTRAINT "grupo_pesquisa_instituicao_pkey" PRIMARY KEY ("grupo_id","instituicao_id")
);

-- CreateTable
CREATE TABLE "estado" (
    "id" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "regiao" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_pesquisa" (
    "id" TEXT NOT NULL,
    "dgp_id" TEXT,
    "nome" TEXT NOT NULL,
    "ano_formacao" INTEGER,
    "area_predominante" TEXT NOT NULL,
    "repercussao" TEXT,
    "situacao" "situacao" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "bairro" TEXT,
    "cep" TEXT,
    "cidade" TEXT,
    "complemento" TEXT,
    "email" TEXT,
    "latitude" DOUBLE PRECISION,
    "logradouro" TEXT,
    "longitude" DOUBLE PRECISION,
    "numero" TEXT,
    "telefone" TEXT,
    "uf" TEXT,
    "website" TEXT,
    "area_conhecimento_id" TEXT,

    CONSTRAINT "grupo_pesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linha_pesquisa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "objetivo" TEXT,
    "grupo_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "dgp_id" TEXT,

    CONSTRAINT "linha_pesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisador" (
    "id" TEXT NOT NULL,
    "lattes_id" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" "tipo_pesquisador",
    "formacao_academica" "formacao_academica",
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "index_h" INTEGER,
    "index_i_10" INTEGER,
    "open_alex_id" TEXT,
    "image_url" TEXT,
    "orcid_id" TEXT,

    CONSTRAINT "pesquisador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membro_grupo" (
    "pesquisador_id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "data_entrada" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "e_lider" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "membro_grupo_pkey" PRIMARY KEY ("pesquisador_id","grupo_id")
);

-- CreateTable
CREATE TABLE "membro_linha_pesquisa" (
    "linha_pesquisa_id" TEXT NOT NULL,
    "pesquisador_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membro_linha_pesquisa_pkey" PRIMARY KEY ("linha_pesquisa_id","pesquisador_id")
);

-- CreateTable
CREATE TABLE "area_conhecimento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "area_pai_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "tipo" "tipo_area_conhecimento",

    CONSTRAINT "area_conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_alex_area_conhecimento" (
    "id" TEXT NOT NULL,
    "termo" TEXT NOT NULL,
    "termo_normalizado" TEXT NOT NULL,
    "termo_estrangeiro" TEXT,
    "external_id" TEXT NOT NULL,
    "tipo" "tipo_open_alex_area_conhecimento" NOT NULL,
    "descricao" TEXT,
    "nomes_alternativos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wikidata_url" TEXT,
    "wikipedia_url" TEXT,
    "area_pai_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "open_alex_area_conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapeamento_area_taxonomia" (
    "id" TEXT NOT NULL,
    "open_alex_area_id" TEXT NOT NULL,
    "area_conhecimento_id" TEXT NOT NULL,
    "tipo_relacao" "tipo_relacao_area_taxonomia",
    "metodo" "metodo_mapeamento_area_taxonomia" NOT NULL,
    "status" "status_mapeamento_area_taxonomia" NOT NULL DEFAULT 'PENDENTE',
    "observacao" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapeamento_area_taxonomia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisador_area_conhecimento" (
    "pesquisador_id" TEXT NOT NULL,
    "area_conhecimento_id" TEXT NOT NULL,

    CONSTRAINT "pesquisador_area_conhecimento_pkey" PRIMARY KEY ("pesquisador_id","area_conhecimento_id")
);

-- CreateTable
CREATE TABLE "grupo_pesquisa_area_conhecimento" (
    "grupo_id" TEXT NOT NULL,
    "area_conhecimento_id" TEXT NOT NULL,
    "atualizado_em" TIMESTAMP(3),
    "confianca" DOUBLE PRECISION,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "justificativa" TEXT,
    "metadata" JSONB,
    "metodo_inferencia" "metodo_inferencia_grupo_area" NOT NULL DEFAULT 'MANUAL',
    "relacao" "tipo_relacao_grupo_area" NOT NULL DEFAULT 'ADICIONAL',

    CONSTRAINT "grupo_pesquisa_area_conhecimento_pkey" PRIMARY KEY ("grupo_id","area_conhecimento_id")
);

-- CreateTable
CREATE TABLE "palavra_chave" (
    "id" TEXT NOT NULL,
    "termo" TEXT NOT NULL,
    "termo_normalizado" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "palavra_chave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor_aplicacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nome_normalizado" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setor_aplicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linha_pesquisa_setor_aplicacao" (
    "linha_pesquisa_id" TEXT NOT NULL,
    "setor_aplicacao_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linha_pesquisa_setor_aplicacao_pkey" PRIMARY KEY ("linha_pesquisa_id","setor_aplicacao_id")
);

-- CreateTable
CREATE TABLE "linha_pesquisa_palavra_chave" (
    "linha_pesquisa_id" TEXT NOT NULL,
    "palavra_chave_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linha_pesquisa_palavra_chave_pkey" PRIMARY KEY ("linha_pesquisa_id","palavra_chave_id")
);

-- CreateTable
CREATE TABLE "producao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ano" INTEGER,
    "tipo" "tipo_producao" NOT NULL DEFAULT 'outra',
    "doi" TEXT,
    "url" TEXT,
    "veiculo" TEXT,
    "resumo" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "issn" TEXT,
    "qualis" "qualis_estrato",

    CONSTRAINT "producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producao_pesquisador" (
    "producao_id" TEXT NOT NULL,
    "pesquisador_id" TEXT NOT NULL,
    "ordem_autoria" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producao_pesquisador_pkey" PRIMARY KEY ("producao_id","pesquisador_id")
);

-- CreateTable
CREATE TABLE "producao_palavra_chave" (
    "producao_id" TEXT NOT NULL,
    "palavra_chave_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producao_palavra_chave_pkey" PRIMARY KEY ("producao_id","palavra_chave_id")
);

-- CreateTable
CREATE TABLE "rag_document" (
    "id" TEXT NOT NULL,
    "source_type" "rag_source_type" NOT NULL,
    "source_id" TEXT NOT NULL,
    "titulo" TEXT,
    "conteudo" TEXT,
    "metadata" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_chunk" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "embedding" vector(1536),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "token_count" INTEGER,
    "metadata" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexing_job" (
    "id" TEXT NOT NULL,
    "source_type" "rag_source_type" NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" "indexing_job_status" NOT NULL DEFAULT 'pendente',
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indexing_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_log" (
    "id" TEXT NOT NULL,
    "modulo" "ModuloSistema" NOT NULL,
    "dgp_id" TEXT,
    "modo_execucao" "ModoExecucao" NOT NULL DEFAULT 'COMPLETA',
    "status" "StatusSessao" NOT NULL DEFAULT 'EMANDAMENTO',
    "registros_processados" INTEGER NOT NULL DEFAULT 0,
    "quantidade_sucessos" INTEGER NOT NULL DEFAULT 0,
    "quantidade_erros" INTEGER NOT NULL DEFAULT 0,
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMP(3),
    "duracao_ms" INTEGER,
    "metadata" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_log_item" (
    "id" TEXT NOT NULL,
    "pipeline_log_id" TEXT NOT NULL,
    "entidade_id" TEXT,
    "tipo_entidade" "TipoEntidadeLog" NOT NULL DEFAULT 'GRUPO',
    "status" "StatusItemLog" NOT NULL,
    "tipo_erro" "TipoErroColeta",
    "mensagem_erro" TEXT,
    "detalhes_erro" TEXT,
    "tempo_ms" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etapa" "pipeline_etapa",

    CONSTRAINT "pipeline_log_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_extracao_grupo" (
    "dgp_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "instituicao" TEXT NOT NULL,
    "status" "FilaExtracaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "similares" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_atualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processamento_iniciado_em" TIMESTAMP(3),
    "ultimo_erro_em" TIMESTAMP(3),
    "ultimo_erro_id" TEXT,

    CONSTRAINT "fila_extracao_grupo_pkey" PRIMARY KEY ("dgp_id")
);

-- CreateTable
CREATE TABLE "fila_extracao_pesquisador" (
    "lattes_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "FilaExtracaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_atualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processamento_iniciado_em" TIMESTAMP(3),
    "ultimo_erro_em" TIMESTAMP(3),
    "ultimo_erro_id" TEXT,

    CONSTRAINT "fila_extracao_pesquisador_pkey" PRIMARY KEY ("lattes_id")
);

-- CreateIndex
CREATE INDEX "grupo_pesquisa_instituicao_instituicao_id_idx" ON "grupo_pesquisa_instituicao"("instituicao_id");

-- CreateIndex
CREATE INDEX "grupo_pesquisa_instituicao_tipo_relacao_idx" ON "grupo_pesquisa_instituicao"("tipo_relacao");

-- CreateIndex
CREATE UNIQUE INDEX "estado_sigla_key" ON "estado"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_pesquisa_dgp_id_key" ON "grupo_pesquisa"("dgp_id");

-- CreateIndex
CREATE INDEX "grupo_pesquisa_area_conhecimento_id_idx" ON "grupo_pesquisa"("area_conhecimento_id");

-- CreateIndex
CREATE UNIQUE INDEX "linha_pesquisa_dgp_id_key" ON "linha_pesquisa"("dgp_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisador_lattes_id_key" ON "pesquisador"("lattes_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisador_open_alex_id_key" ON "pesquisador"("open_alex_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisador_orcid_id_key" ON "pesquisador"("orcid_id");

-- CreateIndex
CREATE UNIQUE INDEX "area_conhecimento_nomeNormalizado_key" ON "area_conhecimento"("nomeNormalizado");

-- CreateIndex
CREATE UNIQUE INDEX "open_alex_area_conhecimento_external_id_key" ON "open_alex_area_conhecimento"("external_id");

-- CreateIndex
CREATE INDEX "open_alex_area_conhecimento_termo_normalizado_idx" ON "open_alex_area_conhecimento"("termo_normalizado");

-- CreateIndex
CREATE INDEX "open_alex_area_conhecimento_tipo_idx" ON "open_alex_area_conhecimento"("tipo");

-- CreateIndex
CREATE INDEX "open_alex_area_conhecimento_area_pai_id_idx" ON "open_alex_area_conhecimento"("area_pai_id");

-- CreateIndex
CREATE INDEX "mapeamento_area_taxonomia_area_conhecimento_id_idx" ON "mapeamento_area_taxonomia"("area_conhecimento_id");

-- CreateIndex
CREATE INDEX "mapeamento_area_taxonomia_status_idx" ON "mapeamento_area_taxonomia"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mapeamento_area_taxonomia_open_alex_area_id_area_conhecimen_key" ON "mapeamento_area_taxonomia"("open_alex_area_id", "area_conhecimento_id");

-- CreateIndex
CREATE INDEX "grupo_pesquisa_area_conhecimento_area_conhecimento_id_idx" ON "grupo_pesquisa_area_conhecimento"("area_conhecimento_id");

-- CreateIndex
CREATE INDEX "grupo_pesquisa_area_conhecimento_relacao_idx" ON "grupo_pesquisa_area_conhecimento"("relacao");

-- CreateIndex
CREATE INDEX "grupo_pesquisa_area_conhecimento_metodo_inferencia_idx" ON "grupo_pesquisa_area_conhecimento"("metodo_inferencia");

-- CreateIndex
CREATE UNIQUE INDEX "palavra_chave_termo_key" ON "palavra_chave"("termo");

-- CreateIndex
CREATE UNIQUE INDEX "palavra_chave_termo_normalizado_key" ON "palavra_chave"("termo_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "setor_aplicacao_nome_key" ON "setor_aplicacao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "setor_aplicacao_nome_normalizado_key" ON "setor_aplicacao"("nome_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "producao_doi_key" ON "producao"("doi");

-- CreateIndex
CREATE INDEX "rag_document_source_type_source_id_idx" ON "rag_document"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "rag_document_source_type_source_id_key" ON "rag_document"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "rag_chunk_document_id_idx" ON "rag_chunk"("document_id");

-- CreateIndex
CREATE INDEX "indexing_job_status_idx" ON "indexing_job"("status");

-- CreateIndex
CREATE INDEX "indexing_job_source_type_source_id_idx" ON "indexing_job"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "pipeline_log_modulo_status_idx" ON "pipeline_log"("modulo", "status");

-- CreateIndex
CREATE INDEX "pipeline_log_dgp_id_idx" ON "pipeline_log"("dgp_id");

-- CreateIndex
CREATE INDEX "pipeline_log_item_pipeline_log_id_idx" ON "pipeline_log_item"("pipeline_log_id");

-- CreateIndex
CREATE INDEX "pipeline_log_item_entidade_id_idx" ON "pipeline_log_item"("entidade_id");

-- CreateIndex
CREATE INDEX "pipeline_log_item_status_idx" ON "pipeline_log_item"("status");

-- CreateIndex
CREATE UNIQUE INDEX "fila_extracao_grupo_dgp_id_key" ON "fila_extracao_grupo"("dgp_id");

-- CreateIndex
CREATE INDEX "fila_extracao_grupo_status_idx" ON "fila_extracao_grupo"("status");

-- CreateIndex
CREATE INDEX "fila_extracao_grupo_processamento_iniciado_em_idx" ON "fila_extracao_grupo"("processamento_iniciado_em");

-- CreateIndex
CREATE INDEX "fila_extracao_grupo_ultimo_erro_id_idx" ON "fila_extracao_grupo"("ultimo_erro_id");

-- CreateIndex
CREATE UNIQUE INDEX "fila_extracao_pesquisador_lattes_id_key" ON "fila_extracao_pesquisador"("lattes_id");

-- CreateIndex
CREATE INDEX "fila_extracao_pesquisador_status_idx" ON "fila_extracao_pesquisador"("status");

-- CreateIndex
CREATE INDEX "fila_extracao_pesquisador_processamento_iniciado_em_idx" ON "fila_extracao_pesquisador"("processamento_iniciado_em");

-- CreateIndex
CREATE INDEX "fila_extracao_pesquisador_ultimo_erro_id_idx" ON "fila_extracao_pesquisador"("ultimo_erro_id");

-- AddForeignKey
ALTER TABLE "instituicao" ADD CONSTRAINT "instituicao_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_pesquisa_instituicao" ADD CONSTRAINT "grupo_pesquisa_instituicao_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo_pesquisa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_pesquisa_instituicao" ADD CONSTRAINT "grupo_pesquisa_instituicao_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_pesquisa" ADD CONSTRAINT "grupo_pesquisa_area_conhecimento_id_fkey" FOREIGN KEY ("area_conhecimento_id") REFERENCES "area_conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_pesquisa" ADD CONSTRAINT "linha_pesquisa_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo_pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_grupo" ADD CONSTRAINT "membro_grupo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo_pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_grupo" ADD CONSTRAINT "membro_grupo_pesquisador_id_fkey" FOREIGN KEY ("pesquisador_id") REFERENCES "pesquisador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_linha_pesquisa" ADD CONSTRAINT "membro_linha_pesquisa_linha_pesquisa_id_fkey" FOREIGN KEY ("linha_pesquisa_id") REFERENCES "linha_pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_linha_pesquisa" ADD CONSTRAINT "membro_linha_pesquisa_pesquisador_id_fkey" FOREIGN KEY ("pesquisador_id") REFERENCES "pesquisador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "area_conhecimento" ADD CONSTRAINT "area_conhecimento_area_pai_id_fkey" FOREIGN KEY ("area_pai_id") REFERENCES "area_conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_alex_area_conhecimento" ADD CONSTRAINT "open_alex_area_conhecimento_area_pai_id_fkey" FOREIGN KEY ("area_pai_id") REFERENCES "open_alex_area_conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapeamento_area_taxonomia" ADD CONSTRAINT "mapeamento_area_taxonomia_area_conhecimento_id_fkey" FOREIGN KEY ("area_conhecimento_id") REFERENCES "area_conhecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapeamento_area_taxonomia" ADD CONSTRAINT "mapeamento_area_taxonomia_open_alex_area_id_fkey" FOREIGN KEY ("open_alex_area_id") REFERENCES "open_alex_area_conhecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisador_area_conhecimento" ADD CONSTRAINT "pesquisador_area_conhecimento_area_conhecimento_id_fkey" FOREIGN KEY ("area_conhecimento_id") REFERENCES "area_conhecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisador_area_conhecimento" ADD CONSTRAINT "pesquisador_area_conhecimento_pesquisador_id_fkey" FOREIGN KEY ("pesquisador_id") REFERENCES "pesquisador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_pesquisa_area_conhecimento" ADD CONSTRAINT "grupo_pesquisa_area_conhecimento_area_conhecimento_id_fkey" FOREIGN KEY ("area_conhecimento_id") REFERENCES "area_conhecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_pesquisa_area_conhecimento" ADD CONSTRAINT "grupo_pesquisa_area_conhecimento_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo_pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_pesquisa_setor_aplicacao" ADD CONSTRAINT "linha_pesquisa_setor_aplicacao_linha_pesquisa_id_fkey" FOREIGN KEY ("linha_pesquisa_id") REFERENCES "linha_pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_pesquisa_setor_aplicacao" ADD CONSTRAINT "linha_pesquisa_setor_aplicacao_setor_aplicacao_id_fkey" FOREIGN KEY ("setor_aplicacao_id") REFERENCES "setor_aplicacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_pesquisa_palavra_chave" ADD CONSTRAINT "linha_pesquisa_palavra_chave_linha_pesquisa_id_fkey" FOREIGN KEY ("linha_pesquisa_id") REFERENCES "linha_pesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linha_pesquisa_palavra_chave" ADD CONSTRAINT "linha_pesquisa_palavra_chave_palavra_chave_id_fkey" FOREIGN KEY ("palavra_chave_id") REFERENCES "palavra_chave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_pesquisador" ADD CONSTRAINT "producao_pesquisador_pesquisador_id_fkey" FOREIGN KEY ("pesquisador_id") REFERENCES "pesquisador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_pesquisador" ADD CONSTRAINT "producao_pesquisador_producao_id_fkey" FOREIGN KEY ("producao_id") REFERENCES "producao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_palavra_chave" ADD CONSTRAINT "producao_palavra_chave_palavra_chave_id_fkey" FOREIGN KEY ("palavra_chave_id") REFERENCES "palavra_chave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_palavra_chave" ADD CONSTRAINT "producao_palavra_chave_producao_id_fkey" FOREIGN KEY ("producao_id") REFERENCES "producao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_chunk" ADD CONSTRAINT "rag_chunk_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "rag_document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_log_item" ADD CONSTRAINT "pipeline_log_item_pipeline_log_id_fkey" FOREIGN KEY ("pipeline_log_id") REFERENCES "pipeline_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_extracao_grupo" ADD CONSTRAINT "fila_extracao_grupo_ultimo_erro_id_fkey" FOREIGN KEY ("ultimo_erro_id") REFERENCES "pipeline_log_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_extracao_pesquisador" ADD CONSTRAINT "fila_extracao_pesquisador_ultimo_erro_id_fkey" FOREIGN KEY ("ultimo_erro_id") REFERENCES "pipeline_log_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

