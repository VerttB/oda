import os
import time
import signal
import sys
import argparse
print(os.path.dirname)

# Adiciona a raiz do data_pipeline ao path para resolver os imports de common e extractors
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from playwright.sync_api import sync_playwright, Error as PlaywrightError
from common.database import init_db
from common.config import dgp_logger as logger, LATTES_DATA_DIR
import json
from extractors.lattes import LattesExtractor
from playwright.sync_api import Page

_stop_requested = False
lattes_url = "https://buscatextual.cnpq.br/buscatextual/busca.do"

lattes_extractor = LattesExtractor()

def sigint_handler(sig, frame):
    global _stop_requested
    logger.warning("Interrupção solicitada pelo usuário. Encerrando...")
    _stop_requested = True

signal.signal(signal.SIGINT, sigint_handler)

def salvar_json(dados, lattes_id):
    if not os.path.exists(LATTES_DATA_DIR):
        os.makedirs(LATTES_DATA_DIR)
    caminho = os.path.join(LATTES_DATA_DIR, f"{lattes_id}.json")
    caminho_tmp = f"{caminho}.tmp"
    formatted_json = json.dumps(dados, indent=4, ensure_ascii=False)
    with open(caminho_tmp, "w", encoding="utf-8") as f:
        f.write(formatted_json)
    os.replace(caminho_tmp, caminho)

def buscar_e_extrair_lattes(context, page: Page, nome_pesquisador):
    try:
        logger.info(f"Iniciando busca por: {nome_pesquisador}")
        page.goto(lattes_url, timeout=60000)
        
        page.fill("input[id='textoBusca']", nome_pesquisador)
        page.click("input[id='buscarDemais']")
        page.click("a[id='botaoBuscaFiltros']")
        page.wait_for_selector(".resultado", timeout=30000)
        
        primeiro_resultado = page.locator(".resultado b a").first
        if primeiro_resultado.count() == 0:
            logger.warning(f"Nenhum resultado encontrado para {nome_pesquisador}")
            return None
            
        primeiro_resultado.click()
        
        page.wait_for_selector(".moldal-interna", state="visible", timeout=15000)

        frame = page.frame_locator("iframe.iframe-modal")
        
        with context.expect_page(timeout=30000) as new_page_info:
            frame.locator("a:has-text('Currículo Lattes')").evaluate("el => el.click()")
    
        curriculo_page = new_page_info.value
        curriculo_page.wait_for_load_state("domcontentloaded")

        html_content = curriculo_page.content()
        basico = lattes_extractor.extrair_informacoes_basicas(html_content)
        projetos = lattes_extractor.extrair_detalhes_projetos(html_content)
        eventos = lattes_extractor.extrair_detalhes_eventos(html_content)
        imagem = lattes_extractor.extrair_imagem(html_content, nome_pesquisador)
        
        nome_formatado = nome_pesquisador.replace(" ", "_") 
        dados = {**basico, **projetos, **eventos}
        salvar_json(dados,nome_pesquisador)
        curriculo_page.close()
        return dados

    except Exception as e:
        logger.error(f"Erro ao processar {nome_pesquisador}: {e}")
        return None, None

import concurrent.futures

def processar_pesquisador_worker(nome):
    """Função executada por cada worker em sua própria thread."""
    if _stop_requested:
        return
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            buscar_e_extrair_lattes(context, page, nome)
        finally:
            browser.close()

def executar_pipeline_lattes(nomes=None):
    if not nomes:
        # Apenas para teste se nada for passado
        nomes = ["Eduardo Manuel de Freitas Jorge", "Altemir José Mossi", "Alfredo Castamann", "Eduardo Arthur Izycki", "Erika Stockler", "Alexandre Hugo Cezar Barros", "Ana Luiza du Bocage Neta", "Anália Carmem Silva de Almeida"]

    logger.info(f"Scraper de Lattes iniciado para {len(nomes)} pesquisadores (2 Workers)")
    
    # Utilizamos ThreadPoolExecutor para rodar 2 pesquisadores ao mesmo tempo
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        # O map distribui a lista de nomes entre as threads disponíveis
        executor.map(processar_pesquisador_worker, nomes)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--nomes", nargs="+", default=[])
    args = parser.parse_args()
    
    executar_pipeline_lattes(args.nomes if args.nomes else None)
