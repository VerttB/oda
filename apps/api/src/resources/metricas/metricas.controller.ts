import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
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

  @Get('grupos-pesquisa/:id')
  findMetricasGrupoPesquisa(@Param('id', ParseUUIDPipe) id: string) {
    return this.metricasService.findMetricasGrupoPesquisa(id);
  }

  @Get('pesquisadores')
  findMetricasPesquisadores() {
    return this.metricasService.findMetricasPesquisadores();
  }
}
