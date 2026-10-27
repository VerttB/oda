export const LANGCHAIN_SERVICE = 'LANGCHAIN_SERVICE';

export const LANGCHAIN_PATTERNS = {
  health: 'langchain.health',
  generate: 'langchain.generate',
  summarize: 'langchain.summarize',
} as const;


export interface LangchainGenerateRequest {
  prompt: string;
  chatHistory?: string;
}

export interface LangchainSummarizeRequest {
  text: string;
  instructions?: string;
}

export interface LangchainResponse {
  output: string;
  model: string;
  provider: 'openai' | 'local';
  createdAt: string;
  sources?: {
    ref: string;
    sourceType: 'grupo_pesquisa' | 'linha_pesquisa' | 'pesquisador' | 'producao' | 'area_conhecimento';
    sourceId: string;
    title: string;
    excerpt: string;
  }[];
  grounded?: boolean;
  retrievalAttempts?: number;
}

export interface LangchainHealthResponse {
  status: 'ok';
  transport: 'tcp';
  provider: 'openai' | 'local';
  model: string;
}
