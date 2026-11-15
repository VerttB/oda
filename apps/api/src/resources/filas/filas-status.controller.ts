import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { createZodDto, ZodResponse } from "nestjs-zod";
import {
  FilaStatusNomeSchema,
  FilaStatusParamSchema,
  FilaStatusResponseSchema,
  FilasStatusResponseSchema,
} from "@oda/shared-types";
import { FilasJwtAuthGuard } from "./filas-auth.guard";
import { FilasRedisGuard } from "./filas-redis.guard";
import { FilasStatusService } from "./filas-status.service";

class FilaStatusParamDto extends createZodDto(FilaStatusParamSchema) {}
class FilaStatusResponseDto extends createZodDto(FilaStatusResponseSchema) {}
class FilasStatusResponseDto extends createZodDto(FilasStatusResponseSchema) {}

@ApiTags("admin-filas")
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: "Token administrativo ausente, inválido ou expirado.",
})
@ApiServiceUnavailableResponse({
  description:
    "Não foi possível consultar o Redis. Nenhum contador fictício é retornado.",
})
@UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
@Controller("admin/filas")
export class FilasStatusController {
  constructor(private readonly status: FilasStatusService) {}

  @Get()
  @ApiOperation({
    summary: "Consulta o status de todas as filas cadastradas",
    description:
      "Inclui scraper, ETL, SIMCC, manutenção e IA. Consulta somente o Redis, sem ler arquivos raw ou iniciar jobs. Se alguma leitura falhar, retorna 503.",
  })
  @ZodResponse({ status: 200, type: FilasStatusResponseDto })
  findAll() {
    return this.status.findAll();
  }

  @Get(":fila/status")
  @ApiParam({
    name: "fila",
    enum: FilaStatusNomeSchema.options,
    example: "etl-pesquisadores",
  })
  @ApiBadRequestResponse({ description: "Nome de fila inválido." })
  @ApiOperation({
    summary: "Consulta estado, contadores e concorrência global de uma fila",
    description:
      "PAUSADA tem prioridade, mesmo com jobs ativos. PROCESSANDO indica jobs ativos, sem garantir progresso. SEM_WORKERS indica ausência de workers conectados. AGUARDANDO inclui jobs com atraso, prioridade ou dependências. OCIOSA indica workers conectados sem trabalho pendente. Falhas retidas permanecem nos contadores. O limite global null não informa a capacidade local dos workers.",
  })
  @ZodResponse({ status: 200, type: FilaStatusResponseDto })
  findOne(@Param() params: FilaStatusParamDto) {
    return this.status.findOne(params.fila);
  }
}
