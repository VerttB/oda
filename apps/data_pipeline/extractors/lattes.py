import requests
from bs4 import BeautifulSoup
import os
import sys
import re
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.config import IMAGE_DIR
os.makedirs(IMAGE_DIR, exist_ok=True)
class LattesExtractor():
    def extrair_imagem(self,html, nome_pesquisador):
        soup = BeautifulSoup(html, "html.parser")
        img = soup.find("img", class_="foto")
        if not img: return ""
        imagem_url = str(img.get("src"))
        if not imagem_url: return ""
        # if imagem_url.startswith('//'):
        #     imagem_url = 'https:' + imagem_url
        try:
            img_resposta = requests.get(imagem_url)
            nome_arquivo = f"{nome_pesquisador}.webp"
            caminho_completo = os.path.join(IMAGE_DIR, nome_arquivo)
            with open(caminho_completo, "wb") as arquivo:
                arquivo.write(img_resposta.content)
        except Exception as e:
            print(f'Não consegui baixar {imagem_url}. Erro: {e}')

    def extrair_informacoes_basicas(self, html):
        soup = BeautifulSoup(html, "html.parser")
        
        basico = {"resumo": "", "orcid_id": "", "nomes_citacoes": [], "nacionalidade": "", "ultima_att_lattes": ""}
        informacoes_autor = soup.find("ul", class_="informacoes-autor")
        if informacoes_autor:
                basico["ultima_att_lattes"] = informacoes_autor.find_all("li")[-1].text.strip()
        
        resumo = soup.find("p", class_="resumo")
        if resumo:
            basico["resumo"] = resumo.text.strip()
            
        a = soup.find("a", {'name': 'Identificacao'})
        if not a:
            return basico
        div = a.find_next("div")
        if not div:
            return basico
        
        divs = div.find_all("div", class_="text-align-right")
        
        chaves = {}
        for div_titulo in divs:
            b_tag = div_titulo.find("b")
            if b_tag:
                chave = b_tag.get_text(strip=True)
        
                div_valor = div_titulo.find_next_sibling("div", class_="layout-cell-9")
                
                if div_valor:
                    valor = div_valor.get_text(strip=True)
                    if "Orcid iD" in chave and valor.startswith("?"):
                        valor = valor.lstrip("?").strip()
                        
                    chaves[chave] = valor

        for chave, valor in chaves.items():
            if chave == "País de Nacionalidade":
                basico["nacionalidade"] = valor
            if chave == "Orcid iD":
                basico["orcid_id"] = valor
            if chave == "Nome em citações bibliográficas":
                basico["nomes_citacoes"] = valor.split(";")
                
        return basico
    
    def extrair_detalhes_projetos(self, html):
        soup = BeautifulSoup(html, "html.parser")
        projeto_default = {"nome": "","descrição": "", "integrantes": "", "ano_inicio": "", "ano_fim": ""}
        projeto = {"projeto_pesquisa":[], "projeto_extensao":[], "projeto_desenvolvimento": [], "outros_projetos": []}
        chaves = {"ProjetosPesquisa":"projeto_pesquisa","ProjetosExtensao":"projeto_extensao" , "ProjetosDesenvolvimento":"projeto_desenvolvimento", "OutrosProjetos": "outros_projetos"}
        
        for chave,chave_projeto in chaves.items():
            a_tag = soup.find("a", {'name': chave})
            if not a_tag: continue
            div_tag = a_tag.find_next("div", class_="layout-cell layout-cell-12 data-cell")
            if not div_tag: continue
            
                       
            for div in div_tag.find_all("div", class_="layout-cell layout-cell-3 text-align-right"):
                b_tag = div.find("b")
                
                if not b_tag:
                    continue

                texto = b_tag.get_text(strip=True)
                
                if not texto or "-" not in texto:
                    continue

                anos = texto.split("-")
                if len(anos) != 2:
                    continue

                novo_projeto = projeto_default.copy()
                novo_projeto["ano_inicio"] = anos[0].strip()
                novo_projeto["ano_fim"] = anos[1].strip()

                nome_div = div.find_next_sibling("div")
                if nome_div:
                    nome = nome_div.get_text(strip=True)
                    novo_projeto["nome"] = nome

                vazio_div = nome_div.find_next_sibling("div",) if nome_div else None
                descricao_div = vazio_div.find_next_sibling("div") if vazio_div else None
                
            
                while descricao_div:
                    texto = descricao_div.get_text(strip=True)

                    if "Projeto certificado" in texto or not texto:
                        descricao_div = descricao_div.find_next_sibling("div")
                        continue
                    if "Descrição:" in texto or "Integrantes:" in texto:
                        break
                    descricao_div = descricao_div.find_next_sibling("div")
              
                if descricao_div:
                    texto_desc = descricao_div.get_text("\n")
                    if "Descrição:" not in texto_desc and "Integrantes:" not in texto_desc:
                        continue
                    for linha in texto_desc.split("\n"):
                        if "Descrição:" in linha:
                            novo_projeto["descrição"] = linha.replace("Descrição:", "").strip()
                        if "Integrantes:" in linha:
                            novo_projeto["integrantes"] = linha.replace("Integrantes:", "").strip()

                projeto[chave_projeto].append(novo_projeto)
                
        return projeto
    
    
    def extrair_detalhes_eventos(self, html):
        soup = BeautifulSoup(html, "html.parser")
        evento_default = {"nome": "", "tipo": "", "ano": ""}
        eventos = {"evento_participacao":[], "evento_organizacao": []}
        chaves = {"ParticipacaoEventos":"evento_participacao","OrganizacaoEventos":"evento_organizacao"}

        for chave, chave_evento in chaves.items():
            seen = set()
            a_tag = soup.find("a", {'name': chave})
            print("Procurando chave", chave)
            if not a_tag: continue
            div_tag = a_tag.find_next("div", class_="inst_back")
            if not div_tag: continue
            for div in div_tag.find_next_siblings("div", class_="layout-cell layout-cell-11"):
                novo_evento = evento_default.copy()
                span_tag = div.find("span")      
                if not span_tag:
                    continue
                texto = span_tag.get_text(strip=True)
                sep = re.split(r"(.+?)\s*(\b\d{4}\b)\.\s*\((.+?)\)", texto)
                if(sep[0] == ""): sep.pop(0)
                if(sep[-1] == "."): sep.pop(-1)
                if len(sep) == 3:
                    novo_evento["nome"] = sep[0].strip()
                    novo_evento["ano"] = sep[1].strip()
                    novo_evento["tipo"] = sep[2].strip()

                if novo_evento["nome"] not in seen:
                    eventos[chave_evento].append(novo_evento)
                    seen.add(novo_evento["nome"])

        return eventos

    def extrair_formacoes(self, html):
        soup = BeautifulSoup(html, "html.parser")
        
        pass
    
    
    def extrair_dados_pesquisador(self,context, page):
        pass
