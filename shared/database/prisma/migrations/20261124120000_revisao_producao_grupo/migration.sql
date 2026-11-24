BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TYPE "DecisaoProducaoGrupo" AS ENUM ('CONFIRMADO', 'REJEITADO', 'INCONCLUSIVO');

CREATE TABLE "producao_grupo_revisao" (
  "grupo_id" TEXT NOT NULL REFERENCES "grupo_pesquisa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "producao_id" TEXT NOT NULL REFERENCES "producao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "versao" INTEGER NOT NULL CHECK ("versao" > 0),
  "decisao" "DecisaoProducaoGrupo" NOT NULL,
  "justificativa" TEXT NOT NULL CHECK (length(btrim("justificativa")) > 0),
  "evidencia" TEXT,
  "fonte_url" TEXT,
  "revisor" TEXT NOT NULL,
  "revisado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "producao_grupo_revisao_confirmacao_evidencia_check"
    CHECK ("decisao" <> 'CONFIRMADO' OR ("evidencia" IS NOT NULL AND length(btrim("evidencia")) > 0)),
  CONSTRAINT "producao_grupo_revisao_pkey" PRIMARY KEY ("grupo_id", "producao_id", "versao")
);

CREATE INDEX "producao_grupo_revisao_grupo_id_decisao_idx" ON "producao_grupo_revisao" ("grupo_id", "decisao");
CREATE INDEX "producao_grupo_revisao_producao_id_idx" ON "producao_grupo_revisao" ("producao_id");
COMMIT;
