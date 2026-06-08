import os
import sqlite3

DATA_DIR = "./apps/scraper/data"
DB_FILE = f"{DATA_DIR}/scraper_estado.db"

def criar_conexao():
    # As flags atómicas protegem 100% dos bloqueios simultaneos OS
    conn = sqlite3.connect(DB_FILE, timeout=60.0, check_same_thread=False, isolation_level=None)
    conn.execute('pragma journal_mode=wal')
    return conn

def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = criar_conexao()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS fila_extracao (
            termo_busca TEXT PRIMARY KEY,
            status TEXT DEFAULT 'PENDENTE',
            tentativas INTEGER DEFAULT 0,
            ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.close()

def salvar_id_banco(identificador, logger):
    conn = criar_conexao()
    try:
        conn.execute("INSERT INTO fila_extracao (termo_busca, status) VALUES (?, 'PENDENTE')", (identificador,))
        logger.debug(f"    [+] ID Mapeada p/ Fila PENDENTE: {identificador}")
    except sqlite3.IntegrityError:
        pass  # Já listado em pagina ou termo anterior!
    finally:
        conn.close()

def obter_proximo_pendente():
    conn = criar_conexao()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT termo_busca, tentativas FROM fila_extracao 
            WHERE status IN ('PENDENTE', 'ERRO') 
            ORDER BY status DESC, tentativas ASC LIMIT 1
        ''')
        return cursor.fetchone()
    finally:
        conn.close()

def atualizar_status(termo, status, tentativa):
    conn = criar_conexao()
    try:
        conn.execute('''
            UPDATE fila_extracao 
            SET status = ?, tentativas = ?, ultima_atualizacao = CURRENT_TIMESTAMP 
            WHERE termo_busca = ?
        ''', (status, tentativa, termo))
    finally:
        conn.close()