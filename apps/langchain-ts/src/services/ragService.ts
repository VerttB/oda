
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { embeddings, model, SUMMARIZE_PROMPT } from "../core/config";
import { prisma } from "../core/db";
import { RagSourceType } from '@oda/database';
import { randomUUID } from 'node:crypto';
import { indexRagDocument } from './ragIndexer';
import { answerWithSelfRag } from './selfRag';
import { buildSemanticFilterConditions } from './semanticFilters';


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
  return answerWithSelfRag(question, chatHistory);
}

export async function ingestDocument(content: string, metadata: any = {}) {
  const sourceId = randomUUID();
  await indexRagDocument(prisma, {
    sourceType: RagSourceType.PRODUCAO,
    sourceId,
    title: metadata.titulo || 'Documento Ingerido',
    content,
    metadata,
  });
  return { success: true };
}

export async function ingestResearchGroup(data: any) {
  const nome = data.nome || "Desconhecido";
  const dgpId = String(data.id_dgp || data.idDgp || '').trim();
  if (!dgpId) throw new Error('O grupo deve possuir id_dgp ou idDgp.');

  let content = `Grupo de Pesquisa: ${nome}\n`;
  content += `DGP ID: ${dgpId}\n`;
  content += `Instituicoes:\n${formatResearchGroupInstitutions(data)}\n`;
  content += `Área: ${data.area || ""}\n`;
  content += `Ano de Formação: ${data.ano_formacao || ""}\n`;
  content += `Repercussão: ${data.repercussao || ""}\n`;

  const group = await prisma.grupoPesquisa.findUnique({ where: { dgpId }, select: { id: true } });
  await indexRagDocument(prisma, {
    sourceType: RagSourceType.GRUPO_PESQUISA,
    sourceId: group?.id ?? dgpId,
    title: nome,
    content,
    metadata: data,
  });

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

export async function performSemanticSearch(
  query: string,
  type?: string,
  limit = 10,
  offset = 0,
  filters: Record<string, unknown> = {},
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new Error('Paginacao invalida para busca semantica.');
  }
  const queryVector = await embeddings.embedQuery(query);
  const vectorStr = `[${queryVector.join(',')}]`;

  const enumMapping: Record<string, string> = {
    'GRUPO_PESQUISA': 'grupo_pesquisa',
    'LINHA_PESQUISA': 'linha_pesquisa',
    'PESQUISADOR': 'pesquisador',
    'PRODUCAO': 'producao',
  };

  const dbType = type ? enumMapping[type] : undefined;
  if (!dbType) throw new Error('Tipo de entidade invalido para busca semantica.');

  const entityAliases: Record<string, string> = {
    grupo_pesquisa: 'g',
    pesquisador: 'p',
    producao: 'pr',
    linha_pesquisa: 'lp',
  };
  const alias = entityAliases[dbType];
  if (!alias) throw new Error('Tipo de entidade invalido para busca semantica.');
  let sql = `
    SELECT rd.source_id as "sourceId", MIN(rc.embedding <-> $1::vector) as score
    FROM rag_chunk rc
    JOIN rag_document rd ON rc.document_id = rd.id
    JOIN ${dbType} ${entityAliases[dbType as keyof typeof entityAliases]}
      ON ${entityAliases[dbType as keyof typeof entityAliases]}.id = rd.source_id
  `;
  const params: unknown[] = [vectorStr, dbType];
  const conditions = [
    'rd.source_type = $2::rag_source_type',
    'rc.embedding IS NOT NULL',
    ...buildSemanticFilterConditions(type as 'GRUPO_PESQUISA' | 'PESQUISADOR' | 'PRODUCAO' | 'LINHA_PESQUISA', filters, value => {
      params.push(value);
      return `$${params.length}`;
    }),
  ];

  sql += ` WHERE ${conditions.join(' AND ')}
    GROUP BY rd.source_id
    ORDER BY score ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  params.push(limit);
  params.push(offset);

  const countParams: unknown[] = [dbType];
  const countAlias = alias;
  const countConditions = [
    'rd.source_type = $1::rag_source_type',
    'rc.embedding IS NOT NULL',
    ...buildSemanticFilterConditions(type as 'GRUPO_PESQUISA' | 'PESQUISADOR' | 'PRODUCAO' | 'LINHA_PESQUISA', filters, value => {
      countParams.push(value);
      return `$${countParams.length}`;
    }),
  ];
  const countSql = `
    SELECT COUNT(DISTINCT rd.source_id)::int as count
    FROM rag_document rd
    JOIN ${dbType} ${countAlias} ON ${countAlias}.id = rd.source_id
    JOIN rag_chunk rc ON rc.document_id = rd.id
    WHERE ${countConditions.join(' AND ')}
  `;

  const [results, countRes] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(sql, ...params),
    prisma.$queryRawUnsafe<any[]>(countSql, ...countParams)
  ]);

  const totalItems = countRes[0]?.count || 0;
  return { results, totalItems };
}
