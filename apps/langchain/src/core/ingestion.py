import os
import json
from langchain_core.documents import Document

def parse_research_group_json(file_path: str) -> list[Document]:
    """
    Parse a CNPq research group JSON and return a list of Documents for LangChain.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            dados = json.load(f)
        
        documents = []
        
        nome = dados.get('nome', 'Desconhecido')
        dgp_id = dados.get('id_dgp', '')
        repercussao = dados.get('repercussao', '')
        area = dados.get('area', '')
        instituicao = dados.get('instituicao', '')
        ano = dados.get('ano_formacao', '')
        
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
        for linha in dados.get('linhas', []):
            l_nome = linha.get('nome', linha.get('titulo', ''))
            l_obj = linha.get('objetivo', '')
            
            linha_content = f"Linha de Pesquisa do Grupo {nome}:\n"
            linha_content += f"Nome: {l_nome}\n"
            linha_content += f"Objetivo: {l_obj}\n"
            
            documents.append(Document(
                page_content=linha_content,
                metadata={"source": file_path, "type": "linha_pesquisa", "grupo": nome}
            ))
        
        # 3. Pesquisadores
        for m in dados.get('membros', []):
            p_nome = m.get('nome', '')
            p_lattes = m.get('lattes', '')
            p_formacao = m.get('formacao_academica', '')
            p_categoria = m.get('categoria_lattes', '')
            
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

def load_all_jsons(data_dir: str) -> list[Document]:
    """
    Load all JSON files from a directory and return a flattened list of Documents.
    """
    all_docs = []
    if not os.path.exists(data_dir):
        print(f"Diretório de dados não encontrado: {data_dir}")
        return []
        
    for file in os.listdir(data_dir):
        if file.endswith('.json'):
            file_path = os.path.join(data_dir, file)
            all_docs.extend(parse_research_group_json(file_path))
            
    return all_docs
