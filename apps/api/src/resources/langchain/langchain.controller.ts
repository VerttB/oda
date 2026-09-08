import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { GenerateLangchainDto } from './dto/generate-langchain.dto';
import { SummarizeLangchainDto } from './dto/summarize-langchain.dto';
import { LangchainGatewayService } from './langchain.service';
import {
  LangchainHealthResponseDto,
  LangchainResponseDto,
} from './dto/response-langchain.dto';

@ApiTags('langchain')
@Controller('langchain')
export class LangchainController {
  constructor(private readonly langchainService: LangchainGatewayService) {}

  @Get('health')
  @ApiOperation({ summary: 'Verifica a saúde do serviço LangChain' })
  @ZodResponse({ status: 200, type: LangchainHealthResponseDto })
  health() {
    return this.langchainService.health();
  }

  @Post('generate')
  @ApiOperation({ summary: 'Gera uma resposta via LangChain' })
  @ApiBody({ type: GenerateLangchainDto })
  @ZodResponse({ status: 201, type: LangchainResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para geração.' })
  generate(@Body() generateLangchainDto: GenerateLangchainDto) {
    return this.langchainService.generate(generateLangchainDto);
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Resume um texto via LangChain' })
  @ApiBody({ type: SummarizeLangchainDto })
  @ZodResponse({ status: 201, type: LangchainResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para resumo.' })
  summarize(@Body() summarizeLangchainDto: SummarizeLangchainDto) {
    return this.langchainService.summarize(summarizeLangchainDto);
  }
}
