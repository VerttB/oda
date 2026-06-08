import os
import time
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from src.core.ingestion import load_all_xmls

class VectorStoreManager:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("A variável GOOGLE_API_KEY não foi encontrada. Verifique seu arquivo .env")
            
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004",
            google_api_key=api_key
        )
        
        self.index_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vector_db")
        self.vector_store = None
        
        if os.path.exists(self.index_path):
            print("Carregando Vector Store persistente do disco (Economia de tokens!)...")
            self.vector_store = FAISS.load_local(
                self.index_path, 
                self.embeddings, 
                allow_dangerous_deserialization=True
            )
        else:
            self._initialize_from_xmls()

    def _initialize_from_xmls(self):
        # Alterado para ler diretamente da pasta de dados do data_pipeline
        # Caminho relativo: oda/apps/langchain/src/vectorstores/../../data_pipeline/data
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        data_dir = os.path.join(base_dir, "data_pipeline", "data")
        
        print(f"Buscando XMLs em: {data_dir}")
        documents = load_all_xmls(data_dir)
        
        if documents:
            print(f"Vetorizando {len(documents)} documentos (Primeira execução)...")
            batch_size = 50
            for i in range(0, len(documents), batch_size):
                batch = documents[i : i + batch_size]
                if self.vector_store is None:
                    self.vector_store = FAISS.from_documents(batch, self.embeddings)
                else:
                    self.vector_store.add_documents(batch)
                if i + batch_size < len(documents):
                    time.sleep(3)
            
            # Salva no disco para a próxima vez
            self.vector_store.save_local(self.index_path)
            print(f"Índice salvo em {self.index_path}")
        else:
            print("Nenhum documento XML encontrado no data_pipeline. Inicializando vazio.")
            initial_docs = [Document(page_content="Sistema Open DGP pronto. Aguardando dados do pipeline.", metadata={"source": "manual"})]
            self.vector_store = FAISS.from_documents(initial_docs, self.embeddings)

    def get_retriever(self, k=2):
        return self.vector_store.as_retriever(search_kwargs={"k": k})

vector_store_manager = VectorStoreManager()
