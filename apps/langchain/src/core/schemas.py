from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class QuestionRequest(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = None

class QuestionResponse(BaseModel):
    answer: str
    source_documents: Optional[list] = None

class IngestRequest(BaseModel):
    dgp_ids: List[str]

class IngestResponse(BaseModel):
    message: str
    documents_processed: int

