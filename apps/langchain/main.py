from dotenv import load_dotenv
import os

# Carrega o .env da raiz do monorepo ANTES de importar qualquer serviço interno que dependa da chave
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
load_dotenv(dotenv_path=env_path)

from fastapi import FastAPI, HTTPException
from src.core.schemas import QuestionRequest, QuestionResponse, IngestRequest, IngestResponse
from src.chains.rag_chain import rag_service
from src.vectorstores.pg_store import vector_store_manager

app = FastAPI(
    title="ODA LangChain Service",
    description="Python microservice for semantic search and RAG using LangChain. This API acts as an AI engine, generating embeddings and answering context-aware queries.",
    version="1.0.0",
    docs_url="/docs", # The Swagger UI
    redoc_url="/redoc" # The ReDoc UI
)

@app.get("/", tags=["Health"])
async def root():
    return {"message": "ODA LangChain Service is running"}

@app.post("/question", response_model=QuestionResponse, tags=["RAG"])
async def ask_question(request: QuestionRequest):
    """
    Recebe uma pergunta em linguagem natural e utiliza o modelo LangChain + RAG (Retrieval-Augmented Generation) 
    para encontrar a resposta nos dados coletados do DGP.
    """
    try:
        answer, sources = await rag_service.answer_question(request.question)
        return QuestionResponse(
            answer=answer,
            source_documents=[{"content": doc.page_content, "metadata": doc.metadata} for doc in sources]
        )
    except Exception as e:
        print(f"Erro no endpoint /question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest", response_model=IngestResponse, tags=["Embeddings"])
async def ingest_documents(request: IngestRequest):
    """
    Endpoint para ser chamado via Webhook (ex: pelo Apache Hop ou Scraper).
    Recebe uma lista de IDs do DGP, lê os arquivos JSON correspondentes da pasta `data_pipeline/data` 
    e gera embeddings para eles, adicionando-os ao Vector Store em memória.
    """
    try:
        count = vector_store_manager.ingest_documents(request.dgp_ids)
        return IngestResponse(
            message="Ingestão concluída com sucesso",
            documents_processed=count
        )
    except Exception as e:
        print(f"Erro no endpoint /ingest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
