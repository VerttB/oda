import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { createZodDto, ZodResponse } from "nestjs-zod";
import {
  FilaStatusParamSchema,
  LimparFilaRequestSchema,
  LimparFilaResponseSchema,
} from "@oda/shared-types";
import { FilasJwtAuthGuard } from "./filas-auth.guard";
import { FilasRedisGuard } from "./filas-redis.guard";
import { FilasCleanupService } from "./filas-cleanup.service";
class ParamDto extends createZodDto(FilaStatusParamSchema) {}
class InputDto extends createZodDto(LimparFilaRequestSchema) {}
class OutputDto extends createZodDto(LimparFilaResponseSchema) {}
@Controller("admin/filas")
@ApiTags("admin-filas")
@ApiBearerAuth()
@UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
export class FilasCleanupController {
  constructor(private readonly service: FilasCleanupService) {}
  @Post(":fila/limpeza")
  @HttpCode(200)
  @ApiOperation({
    summary: "Simula ou remove jobs antigos já encerrados",
    description:
      "Simulação é o padrão. Examina até 500 jobs mais antigos. Jobs do pipeline exigem resultado persistido. A remoção verifica estado e payload atomicamente; jobs ativos, pendentes ou associados a flows são preservados. Não remove JSONs ou logs PostgreSQL.",
  })
  @ZodResponse({ status: 200, type: OutputDto })
  clean(@Param() p: ParamDto, @Body() input: InputDto) {
    return this.service.clean(p.fila, input);
  }
}
