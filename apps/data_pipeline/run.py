import os
import subprocess
import sys
import time

def orquestrar_pipeline_paralelo():
    print("======================================================")
    print(" 🚀 ORQUESTRAÇÃO EM PARALELO (PRODUTOR-CONSUMIDOR) ")
    print("======================================================\n")
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    discovery_script = os.path.join(base_dir, "discovery.py")
    scraper_script = os.path.join(base_dir, "scraper.py")

    print("---------------------------------------------------------")
    print("⚙️ INICIANDO MOTOR 1: A Sonda (Descoberta Paginada de IDs)")
    print("---------------------------------------------------------")
    
    # Disparo sub-processo aberto
    processo_sonda = subprocess.Popen([sys.executable, discovery_script])

    print("Aguardando 15 segundos para injetar volume base na fila PENDENTE do SQLite...")
    time.sleep(15)

    print("\n---------------------------------------------------------")
    print("⚙️ INICIANDO MOTOR 2: O Aspirador XML (Metadados Estruturais)")
    print("---------------------------------------------------------")
    
    # Liga e anexa a maquina aspiradora em cima da Tabela 
    processo_scraper = subprocess.Popen([sys.executable, scraper_script])

    try:
        processo_sonda.wait()
        processo_scraper.wait()
    except KeyboardInterrupt:
        print("\n\n[!] Break Manual (Ctrl+C). Abortando motores com segurança transacional (Graceful Shutdown).")
        processo_sonda.terminate()
        processo_scraper.terminate()

    print("\n======================================================")
    print("          CONCLUÍDO! ESTEIRA DO DATA LAKE ENCERRADA    ")
    print("======================================================")

if __name__ == "__main__":
    orquestrar_pipeline_paralelo()