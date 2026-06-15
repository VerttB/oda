import os
import time
import signal
import sys
import argparse
from playwright.sync_api import sync_playwright, Error as PlaywrightError
import psycopg2
from extractors.dgp_extractor import DGPextractor
from database import init_db, obter_proximo_pendente, atualizar_status, criar_conexao
from config import dgp_logger as logger, DATA_DIR, ETL_BATCH_SIZE
from hop_trigger import trigger_hop_workflow
import json
_stop_requested = False
dgp_extractor = DGPextractor(logger)
def sigint_handler(sig, frame):
    global _stop_requested
    logger.warning("Interrupcao solicitada pelo usuario. Fechando o transacional antes de encerrar.")
    _stop_requested = True

signal.signal(signal.SIGINT, sigint_handler)

def salvar_json(dados, identificador_nome):
    identificador_valido = dados.get("id_dgp", identificador_nome)

    caminho = os.path.join(DATA_DIR, f"{identificador_valido}.json")
    caminho_tmp = f"{caminho}.tmp"
    formatted_json = json.dumps(dados, indent=4, ensure_ascii=False)
    with open(caminho_tmp, "w", encoding="utf-8") as f: f.write(formatted_json)
    os.replace(caminho_tmp, caminho)

def executar_pipeline(grupos_especificos=None):
    init_db()
    global _stop_requested
    
    if grupos_especificos:
        logger.info(f"Injecoes de parametros Manuais mapeados localmente: {grupos_especificos}")
        conn_t = criar_conexao()
        for g in grupos_especificos:
            try:
                conn_t.execute('INSERT INTO fila_extracao (termo_busca, status) VALUES (?, "PENDENTE")', (g,))
            except psycopg2.IntegrityError:
                pass
        conn_t.commit()
        conn_t.close()

    fila_manual = [{"termo": g, "tentativas": 0} for g in grupos_especificos] if grupos_especificos else []
    vazios_consecutivos = 0
    grupos_processados_no_lote = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        while not _stop_requested:
            if grupos_especificos:
                if not fila_manual: break
                alvo = fila_manual.pop(0)
                termo = alvo["termo"]
                tentativas = alvo["tentativas"]
            else:
                item = obter_proximo_pendente()
                if not item:
                    vazios_consecutivos += 1
                    if vazios_consecutivos >= 12:
                        logger.info("Mesa limpa (Idle Threshold atingido). Aspirador finalizou varreduras para consumo.")
                        # Dispara o ETL uma última vez para processar o que sobrar
                        if grupos_processados_no_lote > 0:
                            trigger_hop_workflow()
                        break
                    
                    logger.debug("Tabela pendentes vazia no BD. Em sleep/tracker para sincronismo de novas analises...")
                    time.sleep(5)
                    continue
                else:
                    vazios_consecutivos = 0
                termo, tentativas = item
                
            tentativas += 1
            
            try:
                dados_raspados = dgp_extractor.extrair_dados_grupo(context, page, termo)
                salvar_json(dados_raspados, termo)
                atualizar_status(termo, "CONCLUIDO", tentativas)
                logger.info(f"Tansacao atómica em Lattes Data Lake completada p/ o Alvo: {termo} ✔")
                
                # Incrementa contador de lote e verifica gatilho
                grupos_processados_no_lote += 1
                if grupos_processados_no_lote >= ETL_BATCH_SIZE:
                    logger.info(f"Lote de {ETL_BATCH_SIZE} grupos atingido. Acionando ETL...")
                    trigger_hop_workflow()
                    grupos_processados_no_lote = 0
                
            except PlaywrightError:
                logger.error(f"Erro em camada de processamento de interface. O alvo foi listado em Backoff State.", exc_info=True)
                atualizar_status(termo, "ERRO", tentativas)
                if grupos_especificos: fila_manual.append({"termo": termo, "tentativas": tentativas})
            except Exception as ex:
                if "HTTP_429_RATE_LIMIT" in str(ex):
                    logger.error("Rate Limit detectado -> 60s Block")
                    atualizar_status(termo, "ERRO", tentativas)
                    if grupos_especificos: fila_manual.append({"termo": termo, "tentativas": tentativas})
                    for _ in range(60):
                        if _stop_requested: break
                        time.sleep(1)
                else:
                    logger.error(f"Stack overflow interno de Node/JSON para Lattes XML. Refactoring {termo}.", exc_info=True)
                    atualizar_status(termo, "ERRO", tentativas)
                    if grupos_especificos: fila_manual.append({"termo": termo, "tentativas": tentativas})
                    time.sleep(2)
                    
        browser.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--grupos", nargs="+", default=[])
    parser.add_argument("--arquivo", type=str, default=None)
    args = parser.parse_args()
    
    grupos_alvo = list(args.grupos) if args.grupos else []
    if args.arquivo:
        if os.path.exists(args.arquivo):
            with open(args.arquivo, 'r', encoding='utf-8') as f:
                for linha in f:
                    if linha.strip(): grupos_alvo.append(linha.strip())
        else:
            logger.error("Arquivo List nao rastreado!")
            sys.exit(1)
            
    executar_pipeline(list(set(grupos_alvo)) if len(grupos_alvo) > 0 else None)