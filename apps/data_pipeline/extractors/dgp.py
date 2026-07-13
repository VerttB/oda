from bs4 import BeautifulSoup
from .utils import get_campo_adjacente, limpar_texto
import re
import time
import logging

class DGPextractor:
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        
    
    def extrair_detalhes_rh(self, html_content):
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

    def extrair_detalhes_da_linha(self, html_linha, nome_linha_esperado):
        soup = BeautifulSoup(html_linha, 'html.parser')
        linha = {
            "nome": nome_linha_esperado, 
            "objetivo": "Não Identificado", 
            "areas_conhecimento": [], 
            "palavras_chave": [], 
            "setores_aplicacao": []
        }
        
        container_info = soup.find(id='linhaPesquisa')
        if container_info:
            obj_label = container_info.find(string=re.compile(r'Objetivo', re.IGNORECASE))
            if obj_label:
                target = obj_label.find_parent().find_next_sibling('div', class_='controls')
                if target:
                    linha['objetivo'] = limpar_texto(target.get_text(strip=True))

        secoes = {
            'palavraChave': 'palavras_chave',
            'areaConhecimento': 'areas_conhecimento',
            'setorAplicacao': 'setores_aplicacao'
        }

        for html_id, campo_destino in secoes.items():
            container = soup.find(id=html_id)
            if container:
                lis = container.find_all('li')
                if lis:
                    itens = [limpar_texto(li.get_text(strip=True)) for li in lis if limpar_texto(li.get_text(strip=True))]
                    linha[html_id if html_id != 'palavraChave' else 'palavras_chave'] = itens # Ajuste de nome
                    linha[campo_destino] = itens

        return linha

    def extrair_html_espelho(self, html_content, html_array_linhas_popups, membro_detalhes_map):
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
                    dados["linhas"].append(self.extrair_detalhes_da_linha(html_da_vez, titulo_linha))
                    idx_linha += 1
        return dados

    def extrair_dados_grupo(self,context, page, identificador_dgp):
        self.logger.info(f"Estabelecendo socket direto na extracao do espelho {identificador_dgp}...")
        
        def block_aggressively(route):
            if route.request.resource_type in ["image", "stylesheet", "font", "media"]:
                route.abort()
            else:
                route.continue_()
        
        page.route("**/*", block_aggressively)

        try:
            url_alvo = f"http://dgp.cnpq.br/dgp/espelhogrupo/{identificador_dgp}"
            response = page.goto(url_alvo, timeout=30000, wait_until="domcontentloaded")
            
            if response and response.status == 429: raise Exception("HTTP_429_RATE_LIMIT")
            elif response and response.status >= 500: raise Exception(f"HTTP_ERROR_{response.status}")
            
            page.wait_for_selector("#recursosHumanos", timeout=20000)
            
            membro_detalhes_map = {}
            linhas_tr = page.locator("#recursosHumanos tbody tr").all()
            total_membros = len(linhas_tr)
            
            self.logger.debug(f"Verificando {total_membros} pesquisadores...")
            for index, tr in enumerate(linhas_tr, start=1):
                aba_rh = None
                try:
                    tds = tr.locator("td").all()
                    if len(tds) >= 2:
                        nome = tds[0].inner_text().strip()
                        btn_rh = tr.locator("a[id*='idBtnVisualizarEspelho']").first
                        
                        if btn_rh.count() > 0:
                            self.logger.debug(f"[{index}/{total_membros}] Sonda secundaria -> {nome}")
                            with context.expect_page(timeout=10000) as aba_rh_info:
                                btn_rh.click()
                            
                            aba_rh = aba_rh_info.value
                            aba_rh.route("**/*", block_aggressively)
                            aba_rh.wait_for_load_state("domcontentloaded")
                            
                            detalhes = self.extrair_detalhes_rh(aba_rh.content())
                            membro_detalhes_map[nome] = detalhes
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
                    self.logger.debug(f"[{idx}/{total_linhas}] Varredura em Linhas de Pesquisa...")
                    with context.expect_page(timeout=10000) as aba_linha_info: 
                        botao.click()
                        
                    aba_linha = aba_linha_info.value
                    aba_linha.route("**/*", block_aggressively)
                    aba_linha.wait_for_load_state("domcontentloaded")
                    html_popups.append(aba_linha.content())
                except Exception:
                    pass
                finally:
                    if aba_linha and not aba_linha.is_closed(): aba_linha.close()
                
            html_espelho = page.content()
            return self.extrair_html_espelho(html_espelho, html_popups, membro_detalhes_map)

        except Exception as e:
            raise e
