import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PoolConfig } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

export const pgVectorConfig = {
  postgresConnectionOptions: {
    connectionString: process.env.DATABASE_URL,
  } as PoolConfig,
  tableName: "embeddings_v2",
  columns: {
    idColumnName: "id",
    vectorColumnName: "embedding",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
};

let vectorStore: PGVectorStore | null = null;

export async function getVectorStore() {
  if (vectorStore) return vectorStore;

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPEN_AI_KEY,
    modelName: "text-embedding-3-small",
  });

  vectorStore = await PGVectorStore.initialize(embeddings, pgVectorConfig);
  return vectorStore;
}
