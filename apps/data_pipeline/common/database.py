import os
import psycopg2
from psycopg2.extras import DictCursor
from dotenv import load_dotenv

# Sobe 3 níveis (common -> data_pipeline -> apps -> root)
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), '.env')
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

def criar_conexao():
    """Cria uma conexão com o banco de dados PostgreSQL."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"Erro ao conectar ao PostgreSQL: {e}")
        raise

def init_db():
  
    try:
        conn = criar_conexao()
        conn.close()
        print("Conexão com PostgreSQL estabelecida com sucesso.")
    except Exception as e:
        print(f"Falha na inicialização do banco: {e}")

def salvar_id_banco(id_dgp, logger=None):
    """Insere um novo ID na fila de extração se não existir."""
    conn = criar_conexao()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                INSERT INTO fila_extracao (termo_busca, status)
                VALUES (%s, 'PENDENTE')
                ON CONFLICT (termo_busca) DO NOTHING
            ''', (id_dgp,))
            if logger:
                logger.debug(f"ID {id_dgp} verificado/inserido na fila.")
    finally:
        conn.close()

def obter_proximo_pendente():
    """Recupera o próximo item pendente da fila com lock para evitar duplicidade."""
    conn = criar_conexao()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute('''
                UPDATE fila_extracao
                SET status = 'EM_ANDAMENTO', ultima_atualizacao = CURRENT_TIMESTAMP
                WHERE termo_busca = (
                    SELECT termo_busca
                    FROM fila_extracao
                    WHERE status = 'PENDENTE'
                    ORDER BY ultima_atualizacao ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING termo_busca, tentativas
            ''')
            row = cur.fetchone()
            return (row['termo_busca'], row['tentativas']) if row else None
    finally:
        conn.close()

def atualizar_status(termo, status, tentativa):
    """Atualiza o status e o contador de tentativas de um termo."""
    conn = criar_conexao()
    try:
        with conn.cursor() as cur:
            cur.execute('''
                UPDATE fila_extracao
                SET status = %s, tentativas = %s, ultima_atualizacao = CURRENT_TIMESTAMP
                WHERE termo_busca = %s
            ''', (status, tentativa, termo))
    finally:
        conn.close()
