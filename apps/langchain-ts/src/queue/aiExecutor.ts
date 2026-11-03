import type {
  AiQueueJob,
  AiQueueResult,
  LangchainResponse,
} from '@oda/shared-types';
import {
  askQuestion,
  performSemanticSearch,
  summarizeText,
} from '../services/ragService';

const response = (output: string): LangchainResponse => ({
  output,
  model: 'gpt-4o-mini',
  provider: 'openai',
  createdAt: new Date().toISOString(),
});

export async function executeAiJob(data: AiQueueJob): Promise<AiQueueResult> {
  switch (data.operation) {
    case 'generate': {
      const result = await askQuestion(
        data.payload.prompt,
        data.payload.chatHistory,
      );
      return {
        operation: data.operation,
        result: {
          ...response(result.answer),
          sources: result.sources as LangchainResponse['sources'],
          grounded: result.grounded,
          retrievalAttempts: result.retrievalAttempts,
        },
      };
    }
    case 'summarize':
      return {
        operation: data.operation,
        result: response(
          await summarizeText(data.payload.text, data.payload.instructions),
        ),
      };
    case 'semantic-search': {
      const { query, type, limit, offset, filters } = data.payload;
      return {
        operation: data.operation,
        result: await performSemanticSearch(
          query,
          type,
          limit,
          offset,
          filters,
        ),
      };
    }
  }
}
