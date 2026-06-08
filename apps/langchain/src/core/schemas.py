from pydantic import BaseModel
from typing import Optional, Dict, Any

class QuestionRequest(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = None

class QuestionResponse(BaseModel):
    answer: str
    source_documents: Optional[list] = None
