import os
import time
import signal
import sys
import sqlite3  # <--- ADICIONE ESTA LINHA AQUI!
import logging
import re
import argparse
import xml.etree.ElementTree as ET
import xml.dom.minidom
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, Error as PlaywrightError
from database import init_db, obter_proximo_pendente, atualizar_status, criar_conexao

DATA_DIR = "./apps/scraper/data"
ISSUES_LOG = f"{DATA_DIR}/issues.log"
APP_LOG = f"{DATA_DIR}/scraper.log"

logger = logging.getLogger("DgpScraper")
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - %(message)s')

stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setLevel(logging.DEBUG)
stdout_handler.setFormatter(formatter)
logger.addHandler(stdout_handler)

file_handler = logging.FileHandler(APP_LOG, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

issues_handler = logging.FileHandler(ISSUES_LOG, encoding="utf-8")
issues_handler.setLevel(logging.ERROR)
issues_handler.setFormatter(formatter)
logger.addHandler(issues_handler)

_stop_requested = False

def sigint_handler(sig, frame):
    global _stop_requested
    logger.warning("Interrupcao solicitada pelo usuario. Fechando o transacional antes de encerrar.")
    _stop_requested = True

signal.signal(signal.SIGINT, sigint_handler)

def limpar_texto(texto):
    return texto.replace("¿", "-").replace("  ", " ").strip()

def get_campo_adjacente(soup, nome_campo):
    label = soup.find('label', string=re.compile(nome_campo, re.IGNORECASE))
    if label:
        content = label.find_next_sibling('div', class_='controls')
        return content.get_text(strip=True) if content else ""
    return ""

def extrair_detalhes_rh(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    detalhes = {"lattes": "", "areas": [], "grupos": [], "linhas": []}

    match = re.search(r'espelhorh/(\d{16})', html_content)
    if match: detalhes["lattes"] = match.group(1)

    areas_label = soup.find('label', string=re.compile(r'Áreas de atuação:'))
    if areas_label:
        div_control = areas_label.find_next_sibling('div', class_='controls')
        if div_control:
            for li in div_control.find_all('li'): detalhes["areas"].append(limpar_texto(li.get_text(strip=True)))

    tb_grupos = soup.find('tbody', id=re.compile(r'.*tblEspelhoRHGPAtuacao_data'))
    if tb_grupos:
        for tr in tb_grupos.find_all('tr'):
            tds = tr.find_all('td')
            if len(tds) >= 2 and tds[0].get('colspan') is None: detalhes["grupos"].append(limpar_texto(tds[0].get_text(strip=True)))

    tb_linhas = soup.find('tbody', id=re.compile(r'.*tblEspelhoRHLPAtuacao_data'))
    if tb_linhas:
        for tr in tb_linhas.find_all('tr'):
            tds = tr.find_all('td')
            if len(tds) >= 2 and tds[0].get('colspan') is None: detalhes["linhas"].append(limpar_texto(tds[0].get_text(strip=True)))

    return detalhes

def extrair_detalhes_da_linha(html_linha, nome_linha_esperado):
    soup = BeautifulSoup(html_linha, 'html.parser')
    linha = {"nome": nome_linha_esperado, "objetivo": "Não Identificado", "areas_conhecimento": [], "palavras_chave": [], "setores_aplicacao": []}
    
    for item in soup.find_all(string=re.compile(r'Palavras?[- ]chave:', re.IGNORECASE)):
        conteudo = item.find_next()
        if conteudo: linha['palavras_chave'].append(limpar_texto(conteudo.get_text(" / ", strip=True)))
    for item in soup.find_all(string=re.compile(r'Setor.* aplica', re.IGNORECASE)):
        conteudo = item.find_next()
        if conteudo: linha['setores_aplicacao'].append(limpar_texto(conteudo.get_text(" | ", strip=True)))
    for item in soup.find_all(string=re.compile(r'Área de conhe', re.IGNORECASE)):
        conteudo = item.find_next()
        if conteudo: linha['areas_conhecimento'].append(limpar_texto(conteudo.get_text(" | ", strip=True)))
    for item in soup.find_all(string=re.compile(r'Objetivo:', re.IGNORECASE)):
        conteudo = item.find_next()
        if conteudo: linha['objetivo'] = limpar_texto(conteudo.get_text(" ", strip=True))
    return linha

def extrair_html_espelho(html_content, html_array_linhas_popups, membro_detalhes_map):
    soup = BeautifulSoup(html_content, 'html.parser')
    dados = {
        "id_dgp": "000000", "nome": "N/A", "repercussao": "", "area": "N/A", 
        "instituicao": "N/A", "ano_formacao": "N/A", "endereco": {}, "membros": [], "linhas": []
    }

    id_text = soup.find(string=re.compile(r'espelhogrupo/\d{16}'))
    if id_text:
        match = re.search(r'\d{16}', id_text)
        if match: dados["id_dgp"] = match.group(0)

    titulo_box = soup.find(id='tituloImpressao')
    if titulo_box and titulo_box.find('h1'):
        h1 = titulo_box.find('h1')
        for child in h1.find_all(['div', 'img']): child.decompose()
        dados["nome"] = limpar_texto(h1.get_text(strip=True))

    dados["ano_formacao"] = limpar_texto(get_campo_adjacente(soup, r'Ano de formação'))
    dados["area"] = limpar_texto(get_campo_adjacente(soup, r'Área predominante'))
    dados["instituicao"] = limpar_texto(get_campo_adjacente(soup, r'Instituição do grupo'))

    div_endereco = soup.find(id='endereco')
    if div_endereco:
        dados["endereco"] = {
            "cep": get_campo_adjacente(div_endereco, 'CEP'),
            "localidade": get_campo_adjacente(div_endereco, 'Localidade'),
            "uf": get_campo_adjacente(div_endereco, 'UF'),
            "bairro": get_campo_adjacente(div_endereco, 'Bairro'),
            "complemento": get_campo_adjacente(div_endereco, 'Complemento'),
            "numero": get_campo_adjacente(div_endereco, 'Número'),
            "logradouro": get_campo_adjacente(div_endereco, 'Logradouro')
        }

    div_rep = soup.find(id='repercussao')
    if div_rep:
        textos = [limpar_texto(p.get_text(" ", strip=True)) for p in div_rep.find_all('p', align=False)]
        dados["repercussao"] = "\n".join(textos)

    try:
        lideres_div = soup.find('label', string=re.compile(r'Líder\(es\) do grupo:')).find_next_sibling('div', class_='controls')
        lista_lideres_str = [texto.strip() for texto in lideres_div.stripped_strings if texto.strip()]
    except Exception:
        lista_lideres_str = []

    div_rh = soup.find(id='recursosHumanos')
    if div_rh:
        for tb in div_rh.find_all('table', role='grid'):
            header_anterior = tb.find_previous_sibling('h4')
            if header_anterior and 'egressos' in header_anterior.get_text(strip=True).lower(): continue
            headers = [th.get_text(strip=True).lower() for th in tb.find_all('th')]
            if not headers: continue
            if any("período" in h for h in headers) or any("periodo" in h for h in headers): continue
                
            nome_coluna_alvo = headers[0]
            tb_body = tb.find('tbody')
            if tb_body:
                for tr in tb_body.find_all('tr'):
                    colunas = tr.find_all('td')
                    if len(colunas) >= 2 and colunas[0].get('colspan') is None:
                        nome_membro = limpar_texto(colunas[0].get_text(strip=True))
                        formacao_tabela = limpar_texto(colunas[1].get_text(strip=True)) if len(colunas) > 1 else ""

                        categoria = "PESQUISADOR"
                        if "pesquisador" in nome_coluna_alvo: categoria = "LIDER" if nome_membro in lista_lideres_str else "PESQUISADOR"
                        elif "estudante" in nome_coluna_alvo: categoria = "ESTUDANTE"
                        elif "técnico" in nome_coluna_alvo or "tecnico" in nome_coluna_alvo: categoria = "TECNICO"
                        elif "estrangeiro" in nome_coluna_alvo: categoria = "ESTRANGEIRO"
                            
                        dict_adicional_rh = membro_detalhes_map.get(nome_membro, {})
                        formacao_final = formacao_tabela if formacao_tabela else dict_adicional_rh.get("titulacao", "")

                        dados["membros"].append({
                            "nome": nome_membro, 
                            "lattes": dict_adicional_rh.get("lattes", ""),
                            "formacao_academica": formacao_final,
                            "categoria_lattes": categoria,
                            "areas": dict_adicional_rh.get("areas", []),
                            "grupos_associados": dict_adicional_rh.get("grupos", []),
                            "linhas_associadas": dict_adicional_rh.get("linhas", [])
                        })

    idx_linha = 0
    div_linhas = soup.find(id='linhaPesquisa')
    if div_linhas and div_linhas.find('tbody'):
        for tr in div_linhas.find('tbody').find_all('tr'):
            colunas = tr.find_all('td')
            if len(colunas) > 0 and colunas[0].get('colspan') is None:
                titulo_linha = limpar_texto(colunas[0].get_text(strip=True))
                html_da_vez = html_array_linhas_popups[idx_linha] if idx_linha < len(html_array_linhas_popups) else ""
                dados["linhas"].append(extrair_detalhes_da_linha(html_da_vez, titulo_linha))
                idx_linha += 1
    return dados

def extrair_dados_grupo(context, page, identificador_dgp):
    logger.info(f"Estabelecendo socket direto na extracao do espelho {identificador_dgp}...")
    try:
        url_alvo = f"http://dgp.cnpq.br/dgp/espelhogrupo/{identificador_dgp}"
        response = page.goto(url_alvo, timeout=30000)
        
        if response and response.status == 429: raise Exception("HTTP_429_RATE_LIMIT")
        elif response and response.status >= 500: raise Exception(f"HTTP_ERROR_{response.status}")
        
        page.wait_for_selector("#recursosHumanos", timeout=20000)
        
        membro_detalhes_map = {}
        linhas_tr = page.locator("#recursosHumanos tbody tr").all()
        total_membros = len(linhas_tr)
        
        logger.debug(f"Verificando {total_membros} pesquisadores por abas vinculadas na rede Lattes.")
        for index, tr in enumerate(linhas_tr, start=1):
            aba_rh = None
            try:
                tds = tr.locator("td").all()
                if len(tds) >= 2:
                    nome = tds[0].inner_text().strip()
                    btn_rh = tr.locator("a[id*='idBtnVisualizarEspelho']").first
                    
                    if btn_rh.count() > 0:
                        logger.debug(f"[{index}/{total_membros}] Sonda secundaria em -> {nome}")
                        with context.expect_page(timeout=10000) as aba_rh_info:
                            btn_rh.click()
                        
                        aba_rh = aba_rh_info.value
                        aba_rh.wait_for_load_state("domcontentloaded")
                        time.sleep(0.3)
                        
                        detalhes = extrair_detalhes_rh(aba_rh.content())
                        membro_detalhes_map[nome] = detalhes
                        
                        lattes_coletado = detalhes.get("lattes", "")
                        logger.debug(f"    └─ Lattes capturado com sucesso: {lattes_coletado}")
            except Exception:
                pass
            finally:
                if aba_rh and not aba_rh.is_closed(): aba_rh.close()
        
        html_popups = []
        botoes_linha = page.locator("a[id*='idBtnVisualizarEspelhoLinhaPesquisa']").all()
        total_linhas = len(botoes_linha)
        
        for idx, botao in enumerate(botoes_linha, start=1):
            aba_linha = None
            try:
                logger.debug(f"[{idx}/{total_linhas}] Varredura estrutural em Linhas de Pesquisa Filhas...")
                with context.expect_page(timeout=10000) as aba_linha_info: 
                    botao.click()
                    
                aba_linha = aba_linha_info.value
                aba_linha.wait_for_load_state("domcontentloaded")
                time.sleep(0.3) 
                html_popups.append(aba_linha.content())
            except Exception:
                pass
            finally:
                if aba_linha and not aba_linha.is_closed(): aba_linha.close()
            
        html_espelho = page.content()
        return extrair_html_espelho(html_espelho, html_popups, membro_detalhes_map)

    except Exception as e:
        raise e

def salvar_xml(dados, identificador_nome):
    root = ET.Element("DIRETORIO_DE_GRUPOS")
    grupo_xml = ET.SubElement(root, "GRUPO_DE_PESQUISA")
    
    ET.SubElement(grupo_xml, "NOME").text = dados.get('nome', '')
    ET.SubElement(grupo_xml, "IDENTIFICACAO_DGP").text = dados.get('id_dgp', identificador_nome)
    ET.SubElement(grupo_xml, "REPERCUSSAO").text = dados.get('repercussao', '')
    ET.SubElement(grupo_xml, "AREA").text = dados.get('area', '')
    ET.SubElement(grupo_xml, "INSTITUICAO").text = dados.get('instituicao', '')
    ET.SubElement(grupo_xml, "ANO_FORMACAO").text = dados.get('ano_formacao', '')

    end = dados.get("endereco", {})
    end_xml = ET.SubElement(grupo_xml, "ENDERECO")
    ET.SubElement(end_xml, "CEP").text = end.get("cep", "")
    ET.SubElement(end_xml, "LOCALIDADE").text = end.get("localidade", "")
    ET.SubElement(end_xml, "UF").text = end.get("uf", "")
    ET.SubElement(end_xml, "BAIRRO").text = end.get("bairro", "")
    ET.SubElement(end_xml, "COMPLEMENTO").text = end.get("complemento", "")
    ET.SubElement(end_xml, "NUMERO").text = end.get("numero", "")
    ET.SubElement(end_xml, "LOGRADOURO").text = end.get("logradouro", "")
    
    pesq_xml = ET.SubElement(grupo_xml, "PESQUISADORES")
    for m in dados.get("membros", []):
        m_xml = ET.SubElement(pesq_xml, "PESQUISADOR", 
                      NOME=m['nome'], 
                      LATTES=m['lattes'], 
                      FORMACAO_ACADEMICA=m['formacao_academica'],
                      CATEGORIA=m['categoria_lattes'])
        for a in m.get("areas", []): ET.SubElement(m_xml, "AREA").text = a
        for g in m.get("grupos_associados", []): ET.SubElement(m_xml, "GRUPO_DE_PESQUISA").text = g
        for l in m.get("linhas_associadas", []): ET.SubElement(m_xml, "LINHA_DE_PESQUISA").text = l

    linhas_xml = ET.SubElement(grupo_xml, "LINHAS_DE_PESQUISA")
    for linha in dados.get("linhas", []):
        lx = ET.SubElement(linhas_xml, "LINHA_DE_PESQUISA")
        ET.SubElement(lx, "NOME").text = linha.get('titulo', linha.get('nome', ''))
        ET.SubElement(lx, "OBJETIVO").text = linha.get('objetivo', '')
        for p in linha.get('palavras_chave', []): ET.SubElement(lx, "PALAVRA_CHAVE").text = p
        for a in linha.get('areas_conhecimento', []): ET.SubElement(lx, "AREA").text = a
        for s in linha.get('setores_aplicacao', []): ET.SubElement(lx, "SETOR_APLICACAO").text = s
    
    xmlstr = xml.dom.minidom.parseString(ET.tostring(root)).toprettyxml(indent="   ")
    
    identificador_valido = dados.get("id_dgp", identificador_nome)
    caminho = os.path.join(DATA_DIR, f"{identificador_valido}.xml")
    caminho_tmp = f"{caminho}.tmp"
    
    with open(caminho_tmp, "w", encoding="utf-8") as f: f.write(xmlstr)
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
            except sqlite3.IntegrityError:
                pass
        conn_t.commit()
        conn_t.close()

    fila_manual = [{"termo": g, "tentativas": 0} for g in grupos_especificos] if grupos_especificos else []
    vazios_consecutivos = 0

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
                        break
                    
                    logger.debug("Tabela pendentes vazia no BD. Em sleep/tracker para sincronismo de novas analises...")
                    time.sleep(5)
                    continue
                else:
                    vazios_consecutivos = 0
                termo, tentativas = item
                
            tentativas += 1
            
            try:
                dados_raspados = extrair_dados_grupo(context, page, termo)
                salvar_xml(dados_raspados, termo)
                atualizar_status(termo, "CONCLUIDO", tentativas)
                logger.info(f"Tansacao atómica em Lattes Data Lake completada p/ o Alvo: {termo} ✔")
                
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