from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from src.vectorstores.pg_store import vector_store_manager

class RAGService:
    def __init__(self):
        # Inicializa o Gemini
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite", temperature=0)
        self.retriever = vector_store_manager.get_retriever()
        
        template = """Você é um assistente especializado nos Grupos de Pesquisa do CNPq.
        Use os seguintes pedaços de contexto recuperado para responder à pergunta.
        Se não souber a resposta, diga apenas que não sabe.
        Responda Formalmente.
        Mantenha a resposta concisa.

        Contexto:
        {context}

        Pergunta: {question}
        """
        self.prompt = ChatPromptTemplate.from_template(template)

    def _format_docs(self, docs):
        return "\n\n".join(doc.page_content for doc in docs)

    async def answer_question(self, question: str):
        rag_chain = (
            {"context": self.retriever | self._format_docs, "question": RunnablePassthrough()}
            | self.prompt
            | self.llm
            | StrOutputParser()
        )
    
        answer = rag_chain.invoke(question)
        sources = self.retriever.invoke(question)
        
        return answer, sources

rag_service = RAGService()
