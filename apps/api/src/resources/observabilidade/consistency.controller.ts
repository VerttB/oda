import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { createZodDto, ZodResponse } from "nestjs-zod";
import {
  ConsistenciaRelatorioSchema,
  ConsistenciaHistoricoSchema,
  ConsistenciaQuerySchema,
  getPagination,
} from "@oda/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@oda/database";
import { FilasJwtAuthGuard } from "../filas/filas-auth.guard";
class ReportDto extends createZodDto(ConsistenciaRelatorioSchema) {}
class HistoryDto extends createZodDto(ConsistenciaHistoricoSchema) {}
class QueryDto extends createZodDto(ConsistenciaQuerySchema) {}
const fields = Prisma.sql`id,pipeline_log_id AS "pipelineLogId",estado,escopo,
  iniciado_em::text AS "iniciadoEm",finalizado_em::text AS "finalizadoEm",resultado,erro`;
@ApiTags("admin-consistencia")
@ApiBearerAuth()
@UseGuards(FilasJwtAuthGuard)
@Controller("admin/consistencia-dados")
export class ConsistencyController {
  constructor(private readonly db: PrismaService) {}
  @Get("ultima")
  @ApiOperation({
    summary: "Último relatório encerrado de consistência SIMCC",
    description:
      "Abrange todas as situações. Variações observadas não são prova de causalidade se houver cargas concorrentes.",
  })
  @ZodResponse({ status: 200, type: ReportDto })
  async latest() {
    const rows = await this.db.$queryRaw<
      Array<unknown>
    >`SELECT ${fields} FROM relatorio_consistencia
      WHERE finalizado_em IS NOT NULL ORDER BY finalizado_em DESC,id LIMIT 1`;
    if (!rows.length)
      throw new NotFoundException("Nenhum relatório encerrado disponível.");
    return ConsistenciaRelatorioSchema.parse(rows[0]);
  }
  @Get("historico")
  @ApiOperation({ summary: "Histórico de relatórios SIMCC" })
  @ZodResponse({ status: 200, type: HistoryDto })
  async history(@Query() q: QueryDto) {
    const { skip } = getPagination({ page: q.pagina, size: q.limite });
    const filter = Prisma.sql`iniciado_em::date BETWEEN ${q.dataInicio}::date AND ${q.dataFim}::date`;
    const [dados, total] = await this.db.$transaction(
      [
        this.db
          .$queryRaw`SELECT ${fields} FROM relatorio_consistencia WHERE ${filter}
        ORDER BY iniciado_em DESC,id LIMIT ${q.limite} OFFSET ${skip}`,
        this.db.$queryRaw<
          Array<{ n: number }>
        >`SELECT COUNT(*)::int n FROM relatorio_consistencia WHERE ${filter}`,
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return ConsistenciaHistoricoSchema.parse({
      dados,
      total: total[0].n,
      pagina: q.pagina,
      limite: q.limite,
    });
  }
  @Get("relatorios/:id")
  @ApiOperation({
    summary: "Consulta o relatório SIMCC com métricas e alertas por grupo",
  })
  @ZodResponse({ status: 200, type: ReportDto })
  async report(@Param("id", ParseUUIDPipe) id: string) {
    const rows = await this.db.$queryRaw<
      Array<unknown>
    >`SELECT ${fields} FROM relatorio_consistencia WHERE id=${id}`;
    if (!rows.length) throw new NotFoundException("Relatório não encontrado.");
    return ConsistenciaRelatorioSchema.parse(rows[0]);
  }
}
