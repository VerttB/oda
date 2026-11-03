import { z } from 'zod';

export const LangchainGenerateRequestSchema = z.object({
  prompt: z.string().min(1),
  chatHistory: z.string().optional(),
});

export const LangchainSummarizeRequestSchema = z.object({
  text: z.string().min(1),
  instructions: z.string().optional(),
});

export const LangchainResponseSchema = z.object({
  output: z.string(),
  model: z.string(),
  provider: z.enum(['openai', 'local']),
  createdAt: z.string(),
  sources: z
    .array(
      z.object({
        ref: z.string(),
        sourceType: z.enum([
          'grupo_pesquisa',
          'linha_pesquisa',
          'pesquisador',
          'producao',
          'area_conhecimento',
        ]),
        sourceId: z.string(),
        title: z.string(),
        excerpt: z.string(),
      }),
    )
    .optional(),
  grounded: z.boolean().optional(),
  retrievalAttempts: z.number().int().nonnegative().optional(),
});

export const LangchainHealthResponseSchema = z.object({
  status: z.literal('ok'),
  transport: z.string(),
  provider: z.enum(['openai', 'local']),
  model: z.string(),
});

export const LangchainSemanticSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  type: z.enum(['GRUPO_PESQUISA', 'PESQUISADOR', 'PRODUCAO', 'LINHA_PESQUISA']),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  filters: z.record(z.string(), z.unknown()).default({}),
});

export const LangchainSemanticSearchResponseSchema = z.object({
  results: z.array(z.object({ sourceId: z.string(), score: z.number() })),
  totalItems: z.number().int().nonnegative(),
});

// Envelope interno de transporte. Não altera as respostas públicas das consultas.
const aiJobEnvelope = {
  version: z.literal(1),
  requestId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
};
export const AiQueueJobSchema = z.discriminatedUnion('operation', [
  z.object({
    ...aiJobEnvelope,
    operation: z.literal('generate'),
    payload: LangchainGenerateRequestSchema,
  }),
  z.object({
    ...aiJobEnvelope,
    operation: z.literal('summarize'),
    payload: LangchainSummarizeRequestSchema,
  }),
  z.object({
    ...aiJobEnvelope,
    operation: z.literal('semantic-search'),
    payload: LangchainSemanticSearchRequestSchema,
  }),
]);
export const AiQueueResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('generate'),
    result: LangchainResponseSchema,
  }),
  z.object({
    operation: z.literal('summarize'),
    result: LangchainResponseSchema,
  }),
  z.object({
    operation: z.literal('semantic-search'),
    result: LangchainSemanticSearchResponseSchema,
  }),
]);

export type LangchainSemanticSearchRequest = z.infer<
  typeof LangchainSemanticSearchRequestSchema
>;
export type LangchainSemanticSearchResponse = z.infer<
  typeof LangchainSemanticSearchResponseSchema
>;
export type AiQueueJob = z.infer<typeof AiQueueJobSchema>;
export type AiQueueResult = z.infer<typeof AiQueueResultSchema>;

export type LangchainGenerateRequest = z.infer<
  typeof LangchainGenerateRequestSchema
>;
export type LangchainSummarizeRequest = z.infer<
  typeof LangchainSummarizeRequestSchema
>;
export type LangchainResponse = z.infer<typeof LangchainResponseSchema>;
export type LangchainHealthResponse = z.infer<
  typeof LangchainHealthResponseSchema
>;
