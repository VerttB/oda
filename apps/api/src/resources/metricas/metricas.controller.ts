import { Controller, Get } from '@nestjs/common';
import { MetricasService } from './metricas.service';

@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricasService: MetricasService) {}

  @Get()
  findAll() {
    return this.metricasService.findAll();
  }

  @Get('grupos-pesquisa')
  findMetricasGruposPesquisa() {
    return this.metricasService.findMetricasGruposPesquisa();
  }

  @Get('pesquisadores')
  findMetricasPesquisadores() {
    return this.metricasService.findMetricasPesquisadores();
  }

  @Get('areas-conhecimento')
  findMetricasAreasConhecimento(){
    return this.metricasService.findMetricasAreasConhecimento();
  }
  @Get('producoes')
  findMetricasProducoes(){
    return this.metricasService.findMetricasProducoes();
  }

  @Get('instituicoes')
  findMetricasInstituicoes(){
    return this.metricasService.findMetricasInstituicoes();
  }
}
