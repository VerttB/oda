import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { createZodDto, ZodResponse } from "nestjs-zod";
import {
  PipelineQuerySchema,
  PipelineMetricasSchema,
  PipelineExecucoesSchema,
  PipelineItensSchema,
  PipelineExecucaoSchema,
} from "@oda/shared-types";
import type { Response } from "express";
import { FilasJwtAuthGuard } from "../filas/filas-auth.guard";
import { PipelineService } from "./pipeline.service";
import { LogsExportService } from "./logs-export.service";
class QueryDto extends createZodDto(PipelineQuerySchema) {}
class MetricsDto extends createZodDto(PipelineMetricasSchema) {}
class ExecutionsDto extends createZodDto(PipelineExecucoesSchema) {}
class ItemsDto extends createZodDto(PipelineItensSchema) {}
class ExecutionDto extends createZodDto(PipelineExecucaoSchema) {}
@ApiTags("admin-logs")
@ApiBearerAuth()
@UseGuards(FilasJwtAuthGuard)
@Controller("admin/logs")
export class PipelineController {
  constructor(
    private readonly service: PipelineService,
    private readonly exporter: LogsExportService,
  ) {}
  @Get("metricas")
  @ApiOperation({
    summary: "Métricas diárias e taxa de sucesso dos resultados definitivos",
    description:
      "Dias em America/Bahia. Inclui agregados preservados na retenção. Duração inclui espera entre tentativas quando há telemetria. O filtro status aplica-se apenas aos itens e à exportação.",
  })
  @ZodResponse({ status: 200, type: MetricsDto })
  metrics(@Query() q: QueryDto) {
    return this.service.metrics(q);
  }
  @Get("series-diarias")
  @ApiOperation({
    summary:
      "Série diária dos pipelines; mesmo contrato da consulta de métricas",
  })
  @ZodResponse({ status: 200, type: MetricsDto })
  series(@Query() q: QueryDto) {
    return this.service.metrics(q);
  }
  @Get("execucoes")
  @ApiOperation({ summary: "Lista execuções retidas com paginação" })
  @ZodResponse({ status: 200, type: ExecutionsDto })
  executions(@Query() q: QueryDto) {
    return this.service.executions(q);
  }
  @Get("itens")
  @ApiOperation({
    summary: "Consulta resultados de itens com filtros e paginação",
  })
  @ZodResponse({ status: 200, type: ItemsDto })
  items(@Query() q: QueryDto) {
    return this.service.items(q);
  }
  @Get("execucoes/:id")
  @ApiOperation({ summary: "Consulta uma execução pelo identificador" })
  @ZodResponse({ status: 200, type: ExecutionDto })
  execution(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.execution(id);
  }
  @Get("execucoes/:id/itens")
  @ApiOperation({ summary: "Consulta resultados dos itens de uma execução" })
  @ZodResponse({ status: 200, type: ItemsDto })
  executionItems(@Param("id", ParseUUIDPipe) id: string, @Query() q: QueryDto) {
    return this.service.items(q, id);
  }
  @Get("exportacao")
  @ApiOperation({
    summary: "Exporta itens retidos em CSV ou JSON por streaming",
    description:
      "Lê lotes de 500. Aplica período, escopo, processamento e status; exporta todas as páginas. Novas inserções após o início não entram. Retenção concorrente pode remover registros durante a exportação.",
  })
  @ApiProduces("text/csv", "application/json")
  @ApiResponse({
    status: 200,
    description: "Arquivo de itens do pipeline",
    content: {
      "text/csv": { schema: { type: "string", format: "binary" } },
      "application/json": {
        schema: { type: "array", items: { type: "object" } },
      },
    },
  })
  export(
    @Query() q: QueryDto,
    @Query("formato") formato: string | undefined,
    @Res() res: Response,
  ) {
    if (formato && !["csv", "json"].includes(formato))
      throw new BadRequestException("Use formato csv ou json.");
    return this.exporter.export(q, formato === "json" ? "json" : "csv", res);
  }
}
