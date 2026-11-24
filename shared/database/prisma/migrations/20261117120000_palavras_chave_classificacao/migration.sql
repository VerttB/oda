-- Preserva UUIDs e vínculos existentes. Aplicar somente após backup e atualização dos escritores.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- CreateEnum
CREATE TYPE "OrigemPalavraChave" AS ENUM ('DGP', 'OPENALEX', 'MANUAL', 'EXTRACAO_LOCAL', 'LEGADO_NAO_INFORMADO');

-- CreateEnum
CREATE TYPE "StatusTraducaoPalavraChave" AS ENUM ('PENDENTE', 'AUTOMATICA', 'REVISADA', 'NAO_NECESSARIA');

-- CreateEnum
CREATE TYPE "MetodoAssociacaoPalavraChave" AS ENUM ('DECLARADA', 'CONSULTA_OBRA', 'CLASSIFICACAO_TEXTO', 'REVISAO_MANUAL');

-- CreateEnum
CREATE TYPE "StatusRevisaoEnriquecimento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "MetodoAreaProducao" AS ENUM ('MAPEAMENTO_APROVADO', 'REVISAO_MANUAL');

-- DropIndex
DROP INDEX "palavra_chave_termo_key";

-- DropIndex
DROP INDEX "palavra_chave_termo_normalizado_key";

-- AlterTable
ALTER TABLE "palavra_chave" ADD COLUMN     "chave_identidade" TEXT,
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "idioma_original" TEXT,
ADD COLUMN     "origem" "OrigemPalavraChave" NOT NULL DEFAULT 'LEGADO_NAO_INFORMADO',
ADD COLUMN     "termo_original" TEXT,
ADD COLUMN     "traducao_metadata" JSONB,
ADD COLUMN     "traducao_status" "StatusTraducaoPalavraChave" NOT NULL DEFAULT 'NAO_NECESSARIA';

-- AlterTable
ALTER TABLE "producao_palavra_chave" ADD COLUMN     "avaliada_em" TIMESTAMPTZ(6),
ADD COLUMN     "execucao_id" TEXT,
ADD COLUMN     "hash_entrada" TEXT,
ADD COLUMN     "metodo_associacao" "MetodoAssociacaoPalavraChave",
ADD COLUMN     "revisao" "StatusRevisaoEnriquecimento" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN     "score_original" DOUBLE PRECISION,
ADD COLUMN     "versao_metodo" TEXT;

-- CreateTable
CREATE TABLE "execucao_enriquecimento_producao" (
    "id" TEXT NOT NULL,
    "producao_id" TEXT NOT NULL,
    "obra_external_id" TEXT NOT NULL,
    "consultada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash_entrada" TEXT NOT NULL,
    "hash_resposta" TEXT NOT NULL,
    "versao_metodo" TEXT NOT NULL,
    "avaliada_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidencia" JSONB NOT NULL,

    CONSTRAINT "execucao_enriquecimento_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producao_open_alex_area" (
    "producao_id" TEXT NOT NULL,
    "open_alex_area_id" TEXT NOT NULL,
    "score_original" DOUBLE PRECISION,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "execucao_id" TEXT NOT NULL,
    "versao_metodo" TEXT NOT NULL,
    "revisao" "StatusRevisaoEnriquecimento" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "producao_open_alex_area_pkey" PRIMARY KEY ("producao_id","open_alex_area_id")
);

-- CreateTable
CREATE TABLE "producao_area_conhecimento" (
    "producao_id" TEXT NOT NULL,
    "area_conhecimento_id" TEXT NOT NULL,
    "metodo" "MetodoAreaProducao" NOT NULL,
    "revisao" "StatusRevisaoEnriquecimento" NOT NULL DEFAULT 'PENDENTE',
    "mapeamento_id" TEXT,
    "execucao_id" TEXT,

    CONSTRAINT "producao_area_conhecimento_pkey" PRIMARY KEY ("producao_id","area_conhecimento_id")
);

-- CreateIndex
CREATE INDEX "execucao_enriquecimento_producao_producao_id_avaliada_em_idx" ON "execucao_enriquecimento_producao"("producao_id", "avaliada_em");

-- CreateIndex
CREATE UNIQUE INDEX "execucao_enriquecimento_producao_producao_id_hash_entrada_h_key" ON "execucao_enriquecimento_producao"("producao_id", "hash_entrada", "hash_resposta", "versao_metodo");

-- CreateIndex
CREATE INDEX "producao_open_alex_area_open_alex_area_id_idx" ON "producao_open_alex_area"("open_alex_area_id");

-- CreateIndex
CREATE INDEX "producao_area_conhecimento_area_conhecimento_id_idx" ON "producao_area_conhecimento"("area_conhecimento_id");

-- CreateIndex
CREATE INDEX "palavra_chave_termo_normalizado_idx" ON "palavra_chave"("termo_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "palavra_chave_origem_external_id_key" ON "palavra_chave"("origem", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "palavra_chave_origem_chave_identidade_key" ON "palavra_chave"("origem", "chave_identidade");

-- CreateIndex
CREATE INDEX "producao_palavra_chave_palavra_chave_id_idx" ON "producao_palavra_chave"("palavra_chave_id");

-- AddForeignKey
ALTER TABLE "producao_palavra_chave" ADD CONSTRAINT "producao_palavra_chave_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_enriquecimento_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucao_enriquecimento_producao" ADD CONSTRAINT "execucao_enriquecimento_producao_producao_id_fkey" FOREIGN KEY ("producao_id") REFERENCES "producao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_open_alex_area" ADD CONSTRAINT "producao_open_alex_area_producao_id_fkey" FOREIGN KEY ("producao_id") REFERENCES "producao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_open_alex_area" ADD CONSTRAINT "producao_open_alex_area_open_alex_area_id_fkey" FOREIGN KEY ("open_alex_area_id") REFERENCES "open_alex_area_conhecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_open_alex_area" ADD CONSTRAINT "producao_open_alex_area_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_enriquecimento_producao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_area_conhecimento" ADD CONSTRAINT "producao_area_conhecimento_producao_id_fkey" FOREIGN KEY ("producao_id") REFERENCES "producao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_area_conhecimento" ADD CONSTRAINT "producao_area_conhecimento_area_conhecimento_id_fkey" FOREIGN KEY ("area_conhecimento_id") REFERENCES "area_conhecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_area_conhecimento" ADD CONSTRAINT "producao_area_conhecimento_mapeamento_id_fkey" FOREIGN KEY ("mapeamento_id") REFERENCES "mapeamento_area_taxonomia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producao_area_conhecimento" ADD CONSTRAINT "producao_area_conhecimento_execucao_id_fkey" FOREIGN KEY ("execucao_id") REFERENCES "execucao_enriquecimento_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE producao_palavra_chave ADD CONSTRAINT producao_palavra_chave_score_check
  CHECK (score_original IS NULL OR score_original BETWEEN 0 AND 1);
ALTER TABLE producao_open_alex_area ADD CONSTRAINT producao_open_alex_area_score_check
  CHECK (score_original IS NULL OR score_original BETWEEN 0 AND 1);
COMMIT;
