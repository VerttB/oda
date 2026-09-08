import { z } from 'zod';

export const LangchainGenerateRequestSchema = z.object({
  prompt: z.string().min(1),
  system: z.string().optional(),
  model: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
});

export const LangchainSummarizeRequestSchema = z.object({
  text: z.string().min(1),
  instructions: z.string().optional(),
  model: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
});

export const LangchainResponseSchema = z.object({
  output: z.string(),
  model: z.string(),
  provider: z.enum(['openai', 'local']),
  createdAt: z.string(),
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
