-- This is an empty migration.
CREATE MATERIALIZED VIEW mv_metricas_sistema AS
WITH dados_brutos AS (
    SELECT 'pesquisador' AS entidade, DATE_TRUNC('day', criado_em)::date AS data_registro FROM pesquisador
    UNION ALL
    SELECT 'producao' AS entidade, DATE_TRUNC('day', criado_em)::date AS data_registro FROM producao
    UNION ALL
    SELECT 'grupo_pesquisa' AS entidade, DATE_TRUNC('day', criado_em)::date AS data_registro FROM grupo_pesquisa
    UNION ALL
    SELECT 'instituicao' AS entidade, DATE_TRUNC('day', criado_em)::date AS data_registro FROM instituicao
    UNION ALL
    SELECT 'linha_pesquisa' AS entidade, DATE_TRUNC('day', criado_em)::date AS data_registro FROM linha_pesquisa
    UNION ALL
    SELECT 'area_conhecimento' AS entidade, DATE_TRUNC('day', criado_em)::date AS data_registro FROM area_conhecimento

),
agrupado_por_dia AS (
    -- Agrupa a contagem diária por entidade e data
    SELECT 
        entidade,
        data_registro,
        COUNT(*) AS novos_no_dia
    FROM dados_brutos
    GROUP BY entidade, data_registro
)
-- Aplica a Window Function separando o acumulado por entidade      
SELECT 
    entidade,
    data_registro,
    novos_no_dia::integer as novos_no_dia,
    SUM(novos_no_dia) OVER (
        PARTITION BY entidade 
        ORDER BY data_registro ASC
    ) AS total_acumulado
FROM agrupado_por_dia;

-- Índice composto crucial para permitir REFRESH CONCURRENTLY e filtros rápidos
CREATE UNIQUE INDEX idx_mv_metricas_entidade_data 
ON mv_metricas_sistema (entidade, data_registro);