import time
import re
from playwright.sync_api import sync_playwright, Error as PlaywrightError
from database import init_db, salvar_id_banco
from config import sonda_logger as logger



def run_discovery():
    init_db()
    chaves_varredura = ["a", "e", "i", "o", "u"]

    logger.info("---------------------------------------------------------")
    logger.info("Sonda de Descoberta Vogal/Alfabetica (DGP CNPq)")
    logger.info("---------------------------------------------------------")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        for chave in chaves_varredura:
            logger.info(f"Disparando thread de descoberta. Chave de busca: '{chave.upper()}'")
            
            page.goto("http://dgp.cnpq.br/dgp/faces/consulta/consulta_parametrizada.jsf", timeout=60000)
            
            page.fill("input[id='idFormConsultaParametrizada:idTextoFiltro']", chave)
            page.click("button[id='idFormConsultaParametrizada:idPesquisar']")
            
            try:
                page.wait_for_selector(".itemConsulta", timeout=40000)
            except PlaywrightError:
                logger.warning(f"O identificador falhou ou esvaziou a busca na chave '{chave.upper()}'. Avancando.")
                continue

            pagina_atual = 1
            while True:
                logger.info(f"Mapeamento Tabela Indexadora - Bloco: {chave.upper()} | Pagina: {pagina_atual}")
                time.sleep(1.5)
                
                botoes_espelho = page.locator("a[id*='idBtnVisualizarEspelhoGrupo']").all()
                total_nesta_pagina = len(botoes_espelho)
                
                for index, btn in enumerate(botoes_espelho, start=1):
                    aba = None
                    try:
                        time.sleep(0.5) 
                        with context.expect_page(timeout=15000) as nova_aba_info:
                            btn.click(force=True)
                        
                        aba = nova_aba_info.value
                        aba.wait_for_selector("#tituloImpressao", timeout=10000)
                        
                        conteudo_html = aba.content()
                        
                        match = re.search(r'espelhogrupo/(\d{16})', conteudo_html)
                        if match:
                            salvar_id_banco(match.group(1), logger)

                    except Exception as e:
                        logger.warning(f"    [-] Interrupcao no target HTTP ({index}/{total_nesta_pagina}). Loggado e descartado.")
                    finally:
                        if aba and not aba.is_closed(): aba.close()

                proximo_btn = page.locator(".ui-paginator-next")
                if proximo_btn.count() == 0: break
                    
                is_disabled = "ui-state-disabled" in proximo_btn.first.get_attribute("class")
                if is_disabled:
                    logger.info(f"Fim de indexação para a macro-chave '{chave.upper()}'.")
                    break
                else:
                    proximo_btn.first.click()
                    pagina_atual += 1
                    page.wait_for_selector(".itemConsulta", timeout=20000)
        
        browser.close()
    
    logger.info("---------------------------------------------------------")
    logger.info("Discovery Routine Concluida - Catálogo Salvo em SQLite!")
    logger.info("---------------------------------------------------------")

if __name__ == "__main__":
    run_discovery()