import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Document } from "@langchain/core/documents";
import { getVectorStore } from "../vectorstores/pgStore";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const formatDocumentsAsString = (documents: Document[]) => {
  return documents.map((doc) => doc.pageContent).join("\n\n");
};

const model = new ChatOpenAI({
  openAIApiKey: process.env.OPEN_AI_KEY,
  modelName: "gpt-4o-mini",
  temperature: 0,
});

const ANSWER_PROMPT = PromptTemplate.fromTemplate(`
  Você é um assistente especializado em grupos de pesquisa do CNPq/DGP.
  Use as seguintes partes do contexto recuperado para responder à pergunta.
  Se você não sabe a resposta, apenas diga que não sabe, não tente inventar uma resposta.

  Contexto:
  {context}

  Pergunta: {question}

  Resposta (em português):`);

export async function askQuestion(question: string, chatHistory: string = "") {
  const vectorStore = await getVectorStore();
  const retriever = vectorStore.asRetriever();

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocumentsAsString),
      question: new RunnablePassthrough(),
    },
    ANSWER_PROMPT,
    model,
    new StringOutputParser(),
  ]);

  const result = await chain.invoke(question);
  return result;
}

export async function ingestDocument(content: string, metadata: any = {}) {
  const vectorStore = await getVectorStore();
  await vectorStore.addDocuments([
    {
      pageContent: content,
      metadata,
    },
  ]);
  return { success: true };
}

export async function ingestResearchGroup(data: any) {
  const documents: any[] = [];
  const nome = data.nome || "Desconhecido";
  const dgpId = data.id_dgp || "";

  // 1. Documento principal do Grupo
  let grupoContent = `Grupo de Pesquisa: ${nome}\n`;
  grupoContent += `DGP ID: ${dgpId}\n`;
  grupoContent += `Instituição: ${data.instituicao || ""}\n`;
  grupoContent += `Área: ${data.area || ""}\n`;
  grupoContent += `Ano de Formação: ${data.ano_formacao || ""}\n`;
  grupoContent += `Repercussão: ${data.repercussao || ""}\n`;

  documents.push({
    pageContent: grupoContent,
    metadata: { type: "grupo", id: dgpId },
  });

  // 2. Linhas de Pesquisa
  if (data.linhas) {
    for (const linha of data.linhas) {
      const lNome = linha.nome || linha.titulo || "";
      const lObj = linha.objetivo || "";
      let linhaContent = `Linha de Pesquisa do Grupo ${nome}:\n`;
      linhaContent += `Nome: ${lNome}\n`;
      linhaContent += `Objetivo: ${lObj}\n`;

      documents.push({
        pageContent: linhaContent,
        metadata: { type: "linha_pesquisa", grupo: nome, grupoId: dgpId },
      });
    }
  }

  // 3. Pesquisadores
  if (data.membros) {
    for (const m of data.membros) {
      let pesqContent = `Pesquisador do Grupo ${nome}:\n`;
      pesqContent += `Nome: ${m.nome || ""}\n`;
      pesqContent += `Lattes ID: ${m.lattes || ""}\n`;
      pesqContent += `Formação: ${m.formacao_academica || ""}\n`;
      pesqContent += `Categoria: ${m.categoria_lattes || ""}\n`;

      documents.push({
        pageContent: pesqContent,
        metadata: { type: "pesquisador", grupo: nome, lattes: m.lattes || "" },
      });
    }
  }

  const vectorStore = await getVectorStore();
  await vectorStore.addDocuments(documents);
  return { success: true, count: documents.length };
}
