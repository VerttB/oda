-- Estruturas adicionais. Não remove nem transforma registros de domínio.
CREATE TABLE pipeline_item_execucao (
  id text PRIMARY KEY,
  pipeline_log_id text NOT NULL REFERENCES pipeline_log(id) ON DELETE CASCADE,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  ultima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  tentativas integer NOT NULL DEFAULT 1
);
CREATE INDEX pipeline_item_execucao_pipeline_idx ON pipeline_item_execucao(pipeline_log_id);

CREATE TABLE pipeline_metrica_diaria (
  dia date NOT NULL,
  processamento text NOT NULL,
  escopo text NOT NULL,
  sucessos bigint NOT NULL DEFAULT 0,
  falhas bigint NOT NULL DEFAULT 0,
  duracao_total_ms bigint NOT NULL DEFAULT 0,
  itens_com_duracao bigint NOT NULL DEFAULT 0,
  tentativas_adicionais bigint NOT NULL DEFAULT 0,
  itens_com_tentativas bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, processamento, escopo)
);

CREATE VIEW vw_pipeline_itens AS
SELECT i.id, i.pipeline_log_id, i.entidade_id, i.status::text AS status,
  i.tipo_erro::text AS tipo_erro, i.mensagem_erro, i.detalhes_erro, i.etapa::text AS etapa,
  i.criado_em AS encerrado_em,
  (i.criado_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::date AS dia,
  CASE i.etapa::text
    WHEN 'scrapeGroupPage' THEN 'SCRAPER_DGP'
    WHEN 'PESQUISADOR_LATTES' THEN 'SCRAPER_LATTES'
    WHEN 'DGP_DISCOVERY' THEN 'DESCOBERTA'
    WHEN 'ETL_GRUPO_CARGA' THEN 'ETL_GRUPOS'
    WHEN 'ETL_PESQUISADOR_CARGA' THEN 'ETL_PESQUISADORES'
  END AS processamento,
  CASE WHEN p.metadata->>'scope' IN ('default','simcc') THEN p.metadata->>'scope'
    ELSE 'nao_informado' END AS escopo,
  CASE WHEN e.id IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM
    ((i.criado_em AT TIME ZONE 'UTC') - e.iniciado_em)) * 1000)::bigint
    ELSE i.tempo_ms::bigint END AS tempo_ms,
  e.tentativas
FROM pipeline_log_item i JOIN pipeline_log p ON p.id = i.pipeline_log_id
LEFT JOIN pipeline_item_execucao e ON e.id = i.id
WHERE i.etapa::text IN ('scrapeGroupPage','PESQUISADOR_LATTES','DGP_DISCOVERY',
  'ETL_GRUPO_CARGA','ETL_PESQUISADOR_CARGA');

CREATE VIEW vw_metricas_pipeline_diarias AS
WITH parcelas AS (
  SELECT dia, processamento, escopo,
    COUNT(*) FILTER (WHERE status='SUCESSO') AS sucessos,
    COUNT(*) FILTER (WHERE status='ERRO') AS falhas,
    COALESCE(SUM(tempo_ms),0)::bigint AS duracao_total_ms,
    COUNT(tempo_ms) AS itens_com_duracao,
    COALESCE(SUM(GREATEST(tentativas-1,0)),0)::bigint AS tentativas_adicionais,
    COUNT(tentativas) AS itens_com_tentativas
  FROM vw_pipeline_itens GROUP BY dia, processamento, escopo
  UNION ALL SELECT * FROM pipeline_metrica_diaria
)
SELECT dia, processamento, escopo,
  SUM(sucessos)::bigint AS sucessos, SUM(falhas)::bigint AS falhas,
  SUM(duracao_total_ms)::bigint AS duracao_total_ms,
  SUM(itens_com_duracao)::bigint AS itens_com_duracao,
  SUM(tentativas_adicionais)::bigint AS tentativas_adicionais,
  SUM(itens_com_tentativas)::bigint AS itens_com_tentativas
FROM parcelas GROUP BY dia, processamento, escopo;

CREATE TABLE relatorio_consistencia (
  id text PRIMARY KEY,
  pipeline_log_id text UNIQUE REFERENCES pipeline_log(id) ON DELETE SET NULL,
  escopo text NOT NULL CHECK (escopo='simcc'),
  estado text NOT NULL DEFAULT 'EM_ANDAMENTO',
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  antes jsonb NOT NULL,
  depois jsonb,
  resultado jsonb,
  erro text
);
CREATE INDEX relatorio_consistencia_inicio_idx ON relatorio_consistencia(iniciado_em DESC);
