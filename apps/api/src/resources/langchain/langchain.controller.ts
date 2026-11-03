import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiGatewayTimeoutResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { GenerateLangchainDto } from './dto/generate-langchain.dto';
import { SummarizeLangchainDto } from './dto/summarize-langchain.dto';
import { LangchainGatewayService } from './langchain.service';
import {
  LangchainHealthResponseDto,
  LangchainResponseDto,
} from './dto/response-langchain.dto';
import { Public } from '@/common/auth/public.decorator';
import { AiAccessGuard } from '@/common/rate-limit/ai-access.guard';

@ApiTags('langchain')
@ApiServiceUnavailableResponse({
  description:
    'Redis, fila pausada ou worker de IA indisponível; ou falha no processamento.',
})
@Controller('langchain')
export class LangchainController {
  constructor(private readonly langchainService: LangchainGatewayService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Verifica a fila e a presença de worker de IA',
    description:
      'Verifica o transporte BullMQ; não realiza uma chamada ao provedor.',
  })
  @ZodResponse({ status: 200, type: LangchainHealthResponseDto })
  health() {
    return this.langchainService.health();
  }

  @Post('generate')
  @Public()
  @UseGuards(AiAccessGuard)
  @ApiOperation({
    summary: 'Gera uma resposta pelo worker de IA via BullMQ',
    description:
      'Publica um job e aguarda o resultado por até 120 segundos. A resposta pública permanece compatível.',
  })
  @ApiGatewayTimeoutResponse({
    description:
      'Tempo de espera excedido; uma execução ativa pode continuar no worker.',
  })
  @ApiBody({ type: GenerateLangchainDto })
  @ZodResponse({ status: 201, type: LangchainResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para geração.' })
  generate(@Body() generateLangchainDto: GenerateLangchainDto) {
    return this.langchainService.generate(generateLangchainDto);
  }

  @Post('summarize')
  @Public()
  @UseGuards(AiAccessGuard)
  @ApiOperation({ summary: 'Resume um texto pelo worker de IA via BullMQ' })
  @ApiGatewayTimeoutResponse({
    description:
      'Tempo de espera excedido; uma execução ativa pode continuar no worker.',
  })
  @ApiBody({ type: SummarizeLangchainDto })
  @ZodResponse({ status: 201, type: LangchainResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos para resumo.' })
  summarize(@Body() summarizeLangchainDto: SummarizeLangchainDto) {
    return this.langchainService.summarize(summarizeLangchainDto);
  }
}
