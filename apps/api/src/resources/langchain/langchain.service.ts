import { Injectable } from '@nestjs/common';
import {
  LangchainGenerateRequest,
  LangchainHealthResponse,
  LangchainResponse,
  LangchainSummarizeRequest,
} from './langchain.contracts';

@Injectable()
export class LangchainGatewayService {
  private readonly baseUrl: string;

  constructor() {
    const host = process.env.LANGCHAIN_HOST ?? '127.0.0.1';
    const cleanHost = host.startsWith('http') ? host : `http://${host}`;
    const port = process.env.LANGCHAIN_PORT ?? '8002'; // default to HTTP port of langchain-ts
    this.baseUrl = `${cleanHost}:${port}`;
  }

  async health(): Promise<LangchainHealthResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) throw new Error('LangChain service not ok');
      return {
        status: 'ok',
        transport: 'tcp', // keeping the contract compatible
        provider: 'openai',
        model: 'gpt-4o-mini',
      };
    } catch (e: any) {
      throw new Error(`Langchain health check failed: ${e.message}`);
    }
  }

  async generate(payload: LangchainGenerateRequest): Promise<LangchainResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: payload.prompt }),
      });
      if (!res.ok) throw new Error('Failed to fetch generation');
      const data = await res.json();
      return {
        output: data.answer,
        model: 'gpt-4o-mini',
        provider: 'openai',
        createdAt: new Date().toISOString(),
      };
    } catch (e: any) {
      throw new Error(`Langchain generate failed: ${e.message}`);
    }
  }

  async summarize(payload: LangchainSummarizeRequest): Promise<LangchainResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload.text, instructions: payload.instructions }),
      });
      if (!res.ok) throw new Error('Failed to fetch summary');
      return await res.json();
    } catch (e: any) {
      throw new Error(`Langchain summarize failed: ${e.message}`);
    }
  }

  async semanticSearch(
    query: string, 
    type: 'GRUPO_PESQUISA' | 'PESQUISADOR' | 'PRODUCAO' | 'LINHA_PESQUISA', 
    limit = 10,
    offset = 0
  ): Promise<{ results: { sourceId: string; score: number }[], totalItems: number }> {
    try {
      const res = await fetch(`${this.baseUrl}/semantic-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type, limit, offset }),
      });
      if (!res.ok) throw new Error('Failed to fetch semantic search');
      return await res.json();
    } catch (e: any) {
      throw new Error(`Langchain semantic search failed: ${e.message}`);
    }
  }
}
