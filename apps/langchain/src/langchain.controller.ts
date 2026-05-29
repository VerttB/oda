import { Controller } from "@nestjs/common";
import { MessagePattern } from "@nestjs/microservices";
import { LANGCHAIN_PATTERNS } from "./langchain.contracts";

import type {
  LangchainGenerateRequest,
  LangchainSummarizeRequest,
} from "./langchain.contracts";
import { LangchainService } from "./langchain.service";

@Controller()
export class LangchainController {
  constructor(private readonly langchainService: LangchainService) {}

  @MessagePattern(LANGCHAIN_PATTERNS.health)
  health() {
    return this.langchainService.health();
  }

  @MessagePattern(LANGCHAIN_PATTERNS.generate)
  generate(payload: LangchainGenerateRequest) {
    return this.langchainService.generate(payload);
  }

  @MessagePattern(LANGCHAIN_PATTERNS.summarize)
  summarize(payload: LangchainSummarizeRequest) {
    return this.langchainService.summarize(payload);
  }
}
