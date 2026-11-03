-- Configuração sem radicalização ou remoção de palavras comuns: os dados são multilíngues.
-- Esta migration deve preceder a criação concorrente do índice, que fica em outro arquivo.
BEGIN;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE TEXT SEARCH CONFIGURATION public.oda_producoes (COPY = pg_catalog.simple);
ALTER TEXT SEARCH CONFIGURATION public.oda_producoes
  ALTER MAPPING FOR word, hword, hword_part WITH public.unaccent, pg_catalog.simple;
COMMIT;
