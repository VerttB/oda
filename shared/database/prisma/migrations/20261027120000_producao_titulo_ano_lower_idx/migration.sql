-- Supports the exact, case-insensitive title/year fallback in the Lattes ETL.
-- Keep this expression aligned with lower(titulo) in lattes/productions.ts.
CREATE INDEX CONCURRENTLY "producao_ano_lower_titulo_idx"
ON public.producao (ano, lower(titulo));
