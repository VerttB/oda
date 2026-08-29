
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ANSWER_PROMPT, embeddings, model, SUMMARIZE_PROMPT } from "../core/config";
import { prisma } from "../core/db";


function formatUnidade(value: any): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const nome = typeof value.nome === 'string' ? value.nome.trim() : '';
  const uf = typeof value.uf === 'string' ? value.uf.trim().toUpperCase() : '';

  if (!nome && !uf) return '';
  return `${nome || 'N/A'}${uf ? ` - UF: ${uf}` : ''}`;
}

function formatResearchGroupInstitutions(data: any): string {
  if (Array.isArray(data.instituicoes) && data.instituicoes.length > 0) {
    return data.instituicoes.map((item: any) => {
      const tipo = item.tipoRelacao === 'SEDE' ? 'Sede' : 'Parceira';
      const unidadeFormatada = formatUnidade(item.unidade);
      const unidade = unidadeFormatada ? ` - Unidade: ${unidadeFormatada}` : '';
      const sigla = item.sigla ? ` (${item.sigla})` : '';
      const uf = item.uf ? ` - UF: ${item.uf}` : '';
      return `${tipo}: ${item.nome || item.instituicao || ''}${sigla}${uf}${unidade}`;
    }).join('\n');
  }

  const unidadeFormatada = formatUnidade(data.unidade);
  const unidade = unidadeFormatada ? ` - Unidade: ${unidadeFormatada}` : '';
  return `Sede: ${data.instituicao || ''}${unidade}`;
}


export async function askQuestion(question: string, chatHistory: string = "") {
  const [questionVector] = await embeddings.embedDocuments([question]);
  const vectorStr = `[${questionVector.join(',')}]`;
  const matchedChunks: any[] = await prisma.$queryRawUnsafe(
    `SELECT rc.conteudo 
     FROM rag_chunk rc 
     ORDER BY rc.embedding <-> $1::vector ASC 
     LIMIT 5`,
    vectorStr
  );

  const context = matchedChunks.map(c => c.conteudo).join('\n\n');
  const chain = RunnableSequence.from([
    {
      context: () => context,
      question: new RunnablePassthrough(),
    },
    ANSWER_PROMPT,
    model,
    new StringOutputParser(),
  ]);

  return await chain.invoke(question);
}

export async function ingestDocument(content: string, metadata: any = {}) {
  const docId = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  const doc = await prisma.ragDocument.create({
    data: {
      sourceType: 'PRODUCAO',
      sourceId: docId,
      titulo: metadata.titulo || "Documento Ingerido",
      conteudo: content,
      metadata
    }
  });

  const [vector] = await embeddings.embedDocuments([content]);
  const vectorStr = `[${vector.join(',')}]`;
  const chunkId = require('crypto').randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "rag_chunk" ("id", "document_id", "conteudo", "embedding", "ordem", "metadata", "atualizado_em") 
     VALUES ($1, $2, $3, $4::vector, $5, $6, NOW())`,
    chunkId, doc.id, content, vectorStr, 0, JSON.stringify(metadata)
  );

  return { success: true };
}

export async function ingestResearchGroup(data: any) {
  const nome = data.nome || "Desconhecido";
  const dgpId = data.id_dgp || data.idDgp || "";

  let content = `Grupo de Pesquisa: ${nome}\n`;
  content += `DGP ID: ${dgpId}\n`;
  content += `Instituicoes:\n${formatResearchGroupInstitutions(data)}\n`;
  content += `Área: ${data.area || ""}\n`;
  content += `Ano de Formação: ${data.ano_formacao || ""}\n`;
  content += `Repercussão: ${data.repercussao || ""}\n`;

  const doc = await prisma.ragDocument.upsert({
    where: {
      sourceType_sourceId: {
        sourceType: 'GRUPO_PESQUISA',
        sourceId: dgpId,
      }
    },
    update: {
      titulo: nome,
      conteudo: content,
      metadata: data
    },
    create: {
      sourceType: 'GRUPO_PESQUISA',
      sourceId: dgpId,
      titulo: nome,
      conteudo: content,
      metadata: data
    }
  });

  await prisma.ragChunk.deleteMany({
    where: { documentId: doc.id }
  });

  const [vector] = await embeddings.embedDocuments([content]);
  const vectorStr = `[${vector.join(',')}]`;
  const chunkId = require('crypto').randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "rag_chunk" ("id", "document_id", "conteudo", "embedding", "ordem", "metadata", "atualizado_em") 
     VALUES ($1, $2, $3, $4::vector, $5, $6, NOW())`,
    chunkId, doc.id, content, vectorStr, 0, JSON.stringify(data)
  );

  return { success: true };
}

export async function summarizeText(text: string, instructions?: string) {
  

  const chain = RunnableSequence.from([
    SUMMARIZE_PROMPT,
    model,
    new StringOutputParser(),
  ]);

  return await chain.invoke({
    text,
    instructions: instructions || "Faça um resumo conciso destacando as principais contribuições.",
  });
}

export async function performSemanticSearch(query: string, type?: string, limit = 10, offset = 0) {
  const [queryVector] = await embeddings.embedDocuments([query]);
  const vectorStr = `[${queryVector.join(',')}]`;

  const enumMapping: Record<string, string> = {
    'GRUPO_PESQUISA': 'grupo_pesquisa',
    'LINHA_PESQUISA': 'linha_pesquisa',
    'PESQUISADOR': 'pesquisador',
    'PRODUCAO': 'producao',
    'AREA_CONHECIMENTO': 'area_conhecimento'
  };

  const dbType = type ? (enumMapping[type] || type.toLowerCase()) : undefined;

  let sql = `
    SELECT rd.source_id as "sourceId", MIN(rc.embedding <-> $1::vector) as score
    FROM rag_chunk rc
    JOIN rag_document rd ON rc.document_id = rd.id
  `;
  const params: any[] = [vectorStr];

  if (dbType) {
    sql += ` WHERE rd.source_type = $2::rag_source_type`;
    params.push(dbType);
  }

  sql += `
    GROUP BY rd.source_id
    ORDER BY score ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  params.push(limit);
  params.push(offset);

  let countSql = `SELECT COUNT(DISTINCT source_id)::int as count FROM rag_document`;
  const countParams: any[] = [];
  if (dbType) {
    countSql += ` WHERE source_type = $1::rag_source_type`;
    countParams.push(dbType);
  }

  const [results, countRes] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(sql, ...params),
    prisma.$queryRawUnsafe<any[]>(countSql, ...countParams)
  ]);

  const totalItems = countRes[0]?.count || 0;
  return { results, totalItems };
}
