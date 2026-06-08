from dotenv import load_dotenv
import os

# Carrega o .env ANTES de importar qualquer serviço interno que dependa da chave
load_dotenv()

from fastapi import FastAPI, HTTPException
from src.core.schemas import QuestionRequest, QuestionResponse
from src.chains.rag_chain import rag_service

app = FastAPI(
    title="ODA LangChain Service",
    description="Python microservice for semantic search and RAG using LangChain",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {"message": "ODA LangChain Service is running"}

@app.post("/question", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    try:
        answer, sources = await rag_service.answer_question(request.question)
        return QuestionResponse(
            answer=answer,
            source_documents=[{"content": doc.page_content, "metadata": doc.metadata} for doc in sources]
        )
    except Exception as e:
        print(f"Erro no endpoint /question: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
