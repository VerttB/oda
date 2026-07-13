import os
import time
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_postgres import PGVector
from langchain_postgres.vectorstores import PGVector
from langchain_core.documents import Document
from src.core.ingestion import load_all_jsons, parse_research_group_json

class VectorStoreManager:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("A variável GOOGLE_API_KEY não foi encontrada. Verifique seu arquivo .env")
            
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=api_key
        )
        
        self.connection_string = os.getenv("DATABASE_URL")
        if not self.connection_string:
             raise ValueError("A variável DATABASE_URL não foi encontrada. Verifique seu arquivo .env")
             
        self.collection_name = "oda_research_groups"
        
        self.vector_store = PGVector(
            embeddings=self.embeddings,
            collection_name=self.collection_name,
            connection=self.connection_string,
            use_jsonb=True,
        )
        
        # Opcional: Se quiser inicializar com dados do data_pipeline caso o banco esteja vazio.
        # Por enquanto, o PGVector não tem um jeito simples de contar documentos rapidamente,
        # mas podemos assumir que se for criar do zero, a tabela estará vazia.
        # Deixarei o método disponível, mas a ingestão no PGVector geralmente é feita via webhook.

    def _initialize_from_jsons(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        data_dir = os.path.join(base_dir, "data_pipeline", "data", "dgp")
        
        print(f"Buscando JSONs em: {data_dir}")
        documents = load_all_jsons(data_dir)
        
        if documents:
            print(f"Vetorizando {len(documents)} documentos no PostgreSQL...")
            batch_size = 50
            for i in range(0, len(documents), batch_size):
                batch = documents[i : i + batch_size]
                self.vector_store.add_documents(batch)
                if i + batch_size < len(documents):
                    time.sleep(3) # Respeitando a cota da API
            print("Vetorização no PostgreSQL concluída com sucesso.")
        else:
            print("Nenhum documento JSON encontrado no data_pipeline.")

    def ingest_documents(self, dgp_ids: list[str]) -> int:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        data_dir = os.path.join(base_dir, "data_pipeline", "data", "dgp")
        
        new_docs = []
        for dgp_id in dgp_ids:
            file_path = os.path.join(data_dir, f"{dgp_id}.json")
            if os.path.exists(file_path):
                docs = parse_research_group_json(file_path)
                new_docs.extend(docs)
            else:
                print(f"Arquivo não encontrado para ingestão: {file_path}")
                
        if new_docs:
            self.vector_store.add_documents(new_docs)
            print(f"PostgreSQL atualizado com {len(new_docs)} novos fragmentos.")
            
        return len(new_docs)

    def get_retriever(self, k=2):
        return self.vector_store.as_retriever(search_kwargs={"k": k})

vector_store_manager = VectorStoreManager()
