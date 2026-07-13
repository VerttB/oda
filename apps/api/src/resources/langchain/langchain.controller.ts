import { Body, Controller, Get, Post } from '@nestjs/common';
import { GenerateLangchainDto } from './dto/generate-langchain.dto';
import { SummarizeLangchainDto } from './dto/summarize-langchain.dto';
import { LangchainGatewayService } from './langchain.service';

@Controller('langchain')
export class LangchainController {
  constructor(private readonly langchainService: LangchainGatewayService) {}

  @Get('health')
  health() {
    return this.langchainService.health();
  }

  @Post('generate')
  generate(@Body() generateLangchainDto: GenerateLangchainDto) {
    return this.langchainService.generate(generateLangchainDto);
  }

  @Post('summarize')
  summarize(@Body() summarizeLangchainDto: SummarizeLangchainDto) {
    return this.langchainService.summarize(summarizeLangchainDto);
  }
}
