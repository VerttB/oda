import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { MetricasService } from './metricas.service';
import {
  MetricasAreasConhecimentoResponseDto,
  MetricasGeraisResponseDto,
  MetricasGruposPesquisaResponseDto,
  MetricasInstituicoesResponseDto,
  MetricasPesquisadoresResponseDto,
  MetricasProducoesResponseDto,
  MetricasDiariasResponseDto,
  MetricasDiariasQueryDto
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

  @Get('diarias')
  @ApiOperation({ 
    summary: 'Retorna Métricas Diárias do Sistema',
    description: 'Retorna métricas diárias agrupadas por entidade. Suporta filtros por período (dataInicio/dataFim no formato YYYY-MM-DD) e por entidade específica.'
  })
  @ApiQuery({ name: 'dataInicio', required: false, description: 'Data inicial no formato YYYY-MM-DD (ex: 2025-01-01)' })
  @ApiQuery({ name: 'dataFim', required: false, description: 'Data final no formato YYYY-MM-DD (ex: 2025-12-31)' })
  @ApiQuery({ 
    name: 'entidade', 
    required: false, 
    isArray: true, 
    enum: ['grupo_pesquisa', 'area_conhecimento', 'linha_pesquisa', 'instituicao', 'pesquisador', 'producoes'],
    description: 'Entidade(s) para filtrar. Pode ser repetido para múltiplas entidades. Valores: grupo_pesquisa, area_conhecimento, linha_pesquisa, instituicao, pesquisador, producoes'
  })
  @ZodResponse({status: 200, type: MetricasDiariasResponseDto})
  findMetricasDiarias(@Query() query: MetricasDiariasQueryDto){
    return this.metricasService.findMetricasDiarias(query);
  }
}
