-- STORED calcula as linhas existentes e mantém o vetor ao inserir/alterar título ou resumo.
-- A inclusão reescreve a tabela e exige janela operacional; não altera os campos originais.
ALTER TABLE public.producao
  ADD COLUMN busca_textual tsvector
  GENERATED ALWAYS AS (
    to_tsvector('public.oda_producoes'::regconfig, coalesce(titulo, '') || ' ' || coalesce(resumo, ''))
  ) STORED;
