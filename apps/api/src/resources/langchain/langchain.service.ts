import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  LANGCHAIN_PATTERNS,
  LANGCHAIN_SERVICE,
  LangchainGenerateRequest,
  LangchainHealthResponse,
  LangchainResponse,
  LangchainSummarizeRequest,
} from './langchain.contracts';

@Injectable()
export class LangchainGatewayService {
  constructor(
    @Inject(LANGCHAIN_SERVICE)
    private readonly client: ClientProxy,
  ) {}

  health() {
    return this.send<LangchainHealthResponse>(LANGCHAIN_PATTERNS.health, {});
  }

  generate(payload: LangchainGenerateRequest) {
    return this.send<LangchainResponse>(LANGCHAIN_PATTERNS.generate, payload);
  }

  summarize(payload: LangchainSummarizeRequest) {
    return this.send<LangchainResponse>(LANGCHAIN_PATTERNS.summarize, payload);
  }

  private send<TResponse>(pattern: string, payload: unknown) {
    return firstValueFrom(
      this.client.send<TResponse>(pattern, payload).pipe(timeout(60000)),
    );
  }
}
