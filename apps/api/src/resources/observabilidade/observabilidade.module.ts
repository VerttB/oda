import { Module } from "@nestjs/common";
import { PipelineController } from "./pipeline.controller";
import { PipelineService } from "./pipeline.service";
import { LogsExportService } from "./logs-export.service";
import { ConsistencyController } from "./consistency.controller";
import { FilasJwtAuthGuard } from "../filas/filas-auth.guard";
@Module({
  controllers: [PipelineController, ConsistencyController],
  providers: [PipelineService, LogsExportService, FilasJwtAuthGuard],
})
export class ObservabilidadeModule {}
