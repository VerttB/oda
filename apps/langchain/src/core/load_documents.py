import os
import xml.etree.ElementTree as ET
from langchain_core.documents import Document

def parse_research_group_xml(file_path: str) -> list[Document]:
    """
    Parse a CNPq research group XML and return a list of Documents for LangChain.
    """
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        documents = []
        
        for grupo in root.findall('.//GRUPO_DE_PESQUISA'):
            nome = grupo.findtext('NOME', 'Desconhecido')
            dgp_id = grupo.findtext('IDENTIFICACAO_DGP', '')
            repercussao = grupo.findtext('REPERCUSSAO', '')
            area = grupo.findtext('AREA', '')
            instituicao = grupo.findtext('INSTITUICAO', '')
            ano = grupo.findtext('ANO_FORMACAO', '')
            
            # 1. Documento principal do Grupo
            grupo_content = f"Grupo de Pesquisa: {nome}\n"
            grupo_content += f"DGP ID: {dgp_id}\n"
            grupo_content += f"Instituição: {instituicao}\n"
            grupo_content += f"Área: {area}\n"
            grupo_content += f"Ano de Formação: {ano}\n"
            grupo_content += f"Repercussão: {repercussao}\n"
            
            documents.append(Document(
                page_content=grupo_content,
                metadata={"source": file_path, "type": "grupo", "id": dgp_id}
            ))
            
            # 2. Linhas de Pesquisa
            for linha in grupo.findall('.//LINHAS_DE_PESQUISA/LINHA_DE_PESQUISA'):
                l_nome = linha.findtext('NOME', '')
                l_obj = linha.findtext('OBJETIVO', '')
                
                linha_content = f"Linha de Pesquisa do Grupo {nome}:\n"
                linha_content += f"Nome: {l_nome}\n"
                linha_content += f"Objetivo: {l_obj}\n"
                
                documents.append(Document(
                    page_content=linha_content,
                    metadata={"source": file_path, "type": "linha_pesquisa", "grupo": nome}
                ))
            
            # 3. Pesquisadores
            for pesquisador in grupo.findall('.//PESQUISADORES/PESQUISADOR'):
                p_nome = pesquisador.get('NOME', '')
                p_lattes = pesquisador.get('LATTES', '')
                p_formacao = pesquisador.get('FORMACAO_ACADEMICA', '')
                p_categoria = pesquisador.get('CATEGORIA', '')
                
                pesq_content = f"Pesquisador do Grupo {nome}:\n"
                pesq_content += f"Nome: {p_nome}\n"
                pesq_content += f"Lattes ID: {p_lattes}\n"
                pesq_content += f"Formação: {p_formacao}\n"
                pesq_content += f"Categoria: {p_categoria}\n"
                
                documents.append(Document(
                    page_content=pesq_content,
                    metadata={"source": file_path, "type": "pesquisador", "grupo": nome, "lattes": p_lattes}
                ))
                
        return documents
    except Exception as e:
        print(f"Erro ao processar {file_path}: {e}")
        return []

def load_all_xmls(data_dir: str) -> list[Document]:
    """
    Load all XML files from a directory and return a flattened list of Documents.
    """
    all_docs = []
    if not os.path.exists(data_dir):
        print(f"Diretório de dados não encontrado: {data_dir}")
        return []
        
    for file in os.listdir(data_dir):
        if file.endswith('.xml'):
            file_path = os.path.join(data_dir, file)
            all_docs.extend(parse_research_group_xml(file_path))
            
    return all_docs
