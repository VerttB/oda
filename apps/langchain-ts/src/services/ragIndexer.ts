import { createHash, randomUUID } from 'node:crypto';
import { IndexingJobStatus, Prisma, PrismaClient, RagSourceType } from '@oda/database';
import { embeddings } from '../core/config';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const INDEX_VERSION = 1;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const EMBEDDING_DIMENSIONS = 1536;

export type RagDocumentInput = {
  sourceType: RagSourceType;
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
};

function stableJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function splitText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    if (end === text.length) {
      chunks.push(text.slice(start));
      break;
    }

    const overlapStart = Math.max(start, end - CHUNK_OVERLAP);
    const overlap = text.slice(overlapStart, end);
    const newline = overlap.lastIndexOf('\n');
    const space = overlap.lastIndexOf(' ');
    const boundary = newline >= 0 ? newline : space;
    const splitAt = boundary >= 0 ? overlapStart + boundary + 1 : end;
    chunks.push(text.slice(start, splitAt));
    start = Math.max(start + 1, splitAt - CHUNK_OVERLAP);
  }
  return chunks.filter(chunk => chunk.trim().length > 0);
}

function asJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function indexRagDocument(
  prisma: PrismaClient,
  input: RagDocumentInput,
  options: { force?: boolean } = {},
): Promise<{ indexed: boolean; chunks: number }> {
  const sourceMetadata = input.metadata ?? {};
  const contentHash = createHash('sha256')
    .update(stableJson({
      title: input.title,
      content: input.content,
      metadata: sourceMetadata,
      embeddingModel: EMBEDDING_MODEL,
      indexVersion: INDEX_VERSION,
    }))
    .digest('hex');

  const [existingDocument, previousJob] = await Promise.all([
    prisma.ragDocument.findUnique({
      where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
      select: { id: true, metadata: true },
    }),
    prisma.indexingJob.findFirst({
      where: { sourceType: input.sourceType, sourceId: input.sourceId },
      orderBy: { criadoEm: 'desc' },
    }),
  ]);

  const existingIndex = (existingDocument?.metadata as Record<string, any> | null)?.__ragIndex;
  if (!options.force && existingDocument && existingIndex?.contentHash === contentHash && existingIndex?.indexVersion === INDEX_VERSION
      && existingIndex?.embeddingModel === EMBEDDING_MODEL
      && await prisma.ragChunk.count({ where: { documentId: existingDocument.id } }) > 0) {
    if (previousJob && previousJob.status !== IndexingJobStatus.CONCLUIDO) {
      await prisma.indexingJob.update({ where: { id: previousJob.id }, data: { status: IndexingJobStatus.CONCLUIDO, erro: null } });
    }
    return { indexed: false, chunks: 0 };
  }

  const indexingJob = previousJob
    ? await prisma.indexingJob.update({
      where: { id: previousJob.id },
      data: { status: IndexingJobStatus.EM_ANDAMENTO, erro: null, tentativas: { increment: 1 } },
    })
    : await prisma.indexingJob.create({ data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: IndexingJobStatus.EM_ANDAMENTO,
      tentativas: 1,
    } });

  try {
    const chunks = splitText(input.content);
    if (chunks.length === 0) throw new Error('O documento nao gerou nenhum trecho indexavel.');
    const vectors = await embeddings.embedDocuments(chunks);
    if (vectors.length !== chunks.length || vectors.some(vector => vector.length !== EMBEDDING_DIMENSIONS)) {
      throw new Error(`Embeddings invalidos: esperados ${chunks.length} vetores de ${EMBEDDING_DIMENSIONS} dimensoes.`);
    }

    const indexedMetadata = asJsonInput({
      ...sourceMetadata,
      __ragIndex: { contentHash, embeddingModel: EMBEDDING_MODEL, indexVersion: INDEX_VERSION },
    });

    await prisma.$transaction(async tx => {
      const document = await tx.ragDocument.upsert({
        where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
        update: { titulo: input.title, conteudo: input.content, metadata: indexedMetadata },
        create: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          titulo: input.title,
          conteudo: input.content,
          metadata: indexedMetadata,
        },
      });

      await tx.ragChunk.deleteMany({ where: { documentId: document.id } });
      for (let order = 0; order < chunks.length; order++) {
        const vector = `[${vectors[order].join(',')}]`;
        await tx.$executeRaw`
          INSERT INTO "rag_chunk"
            ("id", "document_id", "conteudo", "embedding", "ordem", "metadata", "atualizado_em")
          VALUES
            (${randomUUID()}, ${document.id}, ${chunks[order]}, ${vector}::vector,
             ${order}, ${JSON.stringify(indexedMetadata)}::jsonb, NOW())
        `;
      }
    });

    await prisma.indexingJob.update({
      where: { id: indexingJob.id },
      data: { status: IndexingJobStatus.CONCLUIDO, erro: null },
    });
    return { indexed: true, chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.indexingJob.update({
      where: { id: indexingJob.id },
      data: { status: IndexingJobStatus.ERRO, erro: message.slice(0, 4000) },
    });
    throw error;
  }
}
