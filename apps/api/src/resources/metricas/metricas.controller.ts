import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { MetricasService } from './metricas.service';
import {
  MetricasAreasConhecimentoResponseDto,
  MetricasGeraisResponseDto,
  MetricasGruposPesquisaResponseDto,
  MetricasInstituicoesResponseDto,
  MetricasPesquisadoresResponseDto,
  MetricasProducoesResponseDto,
} from './dto/response-metricas.dto';

@ApiTags('metricas')
@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricasService: MetricasService) {}

  @Get()
  @ApiOperation({ summary: 'Retorna métricas gerais do sistema' })
  @ZodResponse({ status: 200, type: MetricasGeraisResponseDto })
  findAll() {
    return this.metricasService.findAll();
  }

  @Get('grupos-pesquisa')
  @ApiOperation({ summary: 'Retorna métricas gerais de grupos de pesquisa' })
  @ZodResponse({ status: 200, type: MetricasGruposPesquisaResponseDto })
  findMetricasGruposPesquisa() {
    return this.metricasService.findMetricasGruposPesquisa();
  }

  @Get('pesquisadores')
  @ApiOperation({ summary: 'Retorna métricas gerais de pesquisadores' })
  @ZodResponse({ status: 200, type: MetricasPesquisadoresResponseDto })
  findMetricasPesquisadores() {
    return this.metricasService.findMetricasPesquisadores();
  }

  @Get('areas-conhecimento')
  @ApiOperation({ summary: 'Retorna métricas gerais de áreas de conhecimento' })
  @ZodResponse({ status: 200, type: MetricasAreasConhecimentoResponseDto })
  findMetricasAreasConhecimento(){
    return this.metricasService.findMetricasAreasConhecimento();
  }
  @Get('producoes')
  @ApiOperation({ summary: 'Retorna métricas gerais de produções' })
  @ZodResponse({ status: 200, type: MetricasProducoesResponseDto })
  findMetricasProducoes(){
    return this.metricasService.findMetricasProducoes();
  }

  @Get('instituicoes')
  @ApiOperation({ summary: 'Retorna métricas gerais de instituições' })
  @ZodResponse({ status: 200, type: MetricasInstituicoesResponseDto })
  findMetricasInstituicoes(){
    return this.metricasService.findMetricasInstituicoes();
  }
}
