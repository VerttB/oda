-- Executar fora de uma transação. A coluna já deve existir e estar preenchida.
CREATE INDEX CONCURRENTLY producao_busca_booleana_gin_idx
ON public.producao USING GIN (busca_textual);
