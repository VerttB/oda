import {
  GatewayTimeoutException,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiQueueClient, AiQueueError } from '@oda/queue';
import type {
  LangchainGenerateRequest,
  LangchainSummarizeRequest,
  LangchainSemanticSearchRequest,
} from '@oda/shared-types';

@Injectable()
export class LangchainGatewayService implements OnModuleDestroy {
  constructor(private readonly client: AiQueueClient) {}

  onModuleDestroy() {
    return this.client.close();
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AiQueueError && error.reason === 'TIMEOUT') {
        throw new GatewayTimeoutException(
          'A consulta de IA excedeu o tempo de espera. Uma execução ativa pode continuar no worker.',
        );
      }
      throw new ServiceUnavailableException(
        'O processamento de IA está indisponível. Verifique a fila e o worker de IA.',
      );
    }
  }

  health() {
    return this.run(() => this.client.health());
  }
  generate(payload: LangchainGenerateRequest) {
    return this.run(() => this.client.request('generate', payload));
  }
  summarize(payload: LangchainSummarizeRequest) {
    return this.run(() => this.client.request('summarize', payload));
  }
  semanticSearch(
    query: string,
    type: LangchainSemanticSearchRequest['type'],
    limit = 10,
    offset = 0,
    filters: Record<string, unknown> = {},
  ) {
    return this.run(() =>
      this.client.request('semantic-search', {
        query,
        type,
        limit,
        offset,
        filters,
      }),
    );
  }
}
