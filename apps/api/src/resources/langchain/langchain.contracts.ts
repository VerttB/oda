export const LANGCHAIN_SERVICE = 'LANGCHAIN_SERVICE';

export const LANGCHAIN_PATTERNS = {
  health: 'langchain.health',
  generate: 'langchain.generate',
  summarize: 'langchain.summarize',
} as const;

export interface LangchainGenerateRequest {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
}

export interface LangchainSummarizeRequest {
  text: string;
  instructions?: string;
  model?: string;
  temperature?: number;
}

export interface LangchainResponse {
  output: string;
  model: string;
  provider: 'openai' | 'local';
  createdAt: string;
}

export interface LangchainHealthResponse {
  status: 'ok';
  transport: 'tcp';
  provider: 'openai' | 'local';
  model: string;
}
