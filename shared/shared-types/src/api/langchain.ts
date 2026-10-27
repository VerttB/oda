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
  sources: z.array(z.object({
    ref: z.string(),
    sourceType: z.enum(['grupo_pesquisa', 'linha_pesquisa', 'pesquisador', 'producao', 'area_conhecimento']),
    sourceId: z.string(),
    title: z.string(),
    excerpt: z.string(),
  })).optional(),
  grounded: z.boolean().optional(),
  retrievalAttempts: z.number().int().nonnegative().optional(),
});

export const LangchainHealthResponseSchema = z.object({
  status: z.literal('ok'),
  transport: z.string(),
  provider: z.enum(['openai', 'local']),
  model: z.string(),
});

export type LangchainGenerateRequest = z.infer<
  typeof LangchainGenerateRequestSchema
>;
export type LangchainSummarizeRequest = z.infer<
  typeof LangchainSummarizeRequestSchema
>;
export type LangchainResponse = z.infer<typeof LangchainResponseSchema>;
export type LangchainHealthResponse = z.infer<typeof LangchainHealthResponseSchema>;
