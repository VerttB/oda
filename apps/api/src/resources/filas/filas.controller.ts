import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import {
  DgpJobResponseDto,
  DgpJobsAtivosResponseDto,
  DiscoveryJobResponseDto,
  DiscoveryJobsAtivosResponseDto,
  EnfileirarDiscoveryDto,
  EnfileirarDiscoveryResponseDto,
  EnfileirarDgpDto,
  EnfileirarDgpResponseDto,
  EnfileirarLattesDto,
  EnfileirarLattesResponseDto,
  EtlGroupJobResponseDto,
  EtlGroupJobsAtivosResponseDto,
  EtlResearcherJobResponseDto,
  EtlResearcherJobsAtivosResponseDto,
  ConsultarFilaJobsDto,
  EnfileirarEtlDto,
  EnfileirarEtlResponseDto,
  EtlDispatchJobResponseDto,
  FilaJobsResponseDto,
  FilaParamDto,
  FilaResumoResponseDto,
  LattesJobResponseDto,
  LattesJobsAtivosResponseDto,
  WorkerFilaResponseDto,
  WorkersAtivosResponseDto,
  EnfileirarBackupDbDto,
  EnfileirarBackupDbResponseDto,
  EnfileirarRefreshMvDto,
  EnfileirarRefreshMvResponseDto,
  EnfileirarCleanupLogsDto,
  EnfileirarCleanupLogsResponseDto,
  EnfileirarReconcileStuckQueuesDto,
  EnfileirarReconcileStuckQueuesResponseDto,
  SystemMaintenanceJobStatusDto,
  SystemMaintenanceJobsAtivosResponseDto,
} from './dto/filas.dto';
import {
  SystemMaintenanceJobStatus,
  SystemMaintenanceJobsAtivosResponse,
} from '@oda/shared-types';
import { FilasService } from './filas.service';
import { FilasJwtAuthGuard } from './filas-auth.guard';
import { FilasRedisGuard } from './filas-redis.guard';

@ApiTags('admin-filas')
@ApiServiceUnavailableResponse({ description: 'Filas temporariamente indisponiveis enquanto o Redis estiver fora do ar.' })
@Controller('admin/filas')
export class FilasController {
  constructor(private readonly filasService: FilasService) {}

  @Get('workers')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os workers conectados às filas do pipeline' })
  @ApiOkResponse({ type: WorkersAtivosResponseDto })
  findActiveWorkers() {
    return this.filasService.findActiveWorkers();
  }

  @Get('workers/:workerId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta um worker conectado pelo ID da conexão Redis' })
  @ApiParam({ name: 'workerId', description: 'ID volátil da conexão; muda quando o worker reinicia.' })
  @ApiNotFoundResponse({ description: 'Worker não está ativo ou não existe.' })
  @ZodResponse({ status: 200, type: WorkerFilaResponseDto })
  findWorker(@Param('workerId') workerId: string) {
    return this.filasService.findWorker(workerId);
  }

  @Get('dgp/jobs/ativos')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os jobs DGP atualmente em processamento' })
  @ZodResponse({ status: 200, type: DgpJobsAtivosResponseDto })
  findActiveDgpJobs() {
    return this.filasService.findActiveDgpJobs();
  }

  @Get('dgp/jobs/:jobId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job DGP' })
  @ApiParam({ name: 'jobId', example: 'dgp-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: DgpJobResponseDto })
  findDgpJob(@Param('jobId') jobId: string) {
    return this.filasService.findDgpJob(jobId);
  }

  @Post('dgp/jobs')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publica a coleta de um grupo na fila DGP' })
  @ApiBadRequestResponse({ description: 'O ID DGP deve conter exatamente 16 dígitos.' })
  @ApiConflictResponse({ description: 'Um job finalizado ainda aguarda reconciliação.' })
  @ApiServiceUnavailableResponse({ description: 'O manifesto foi salvo, mas o Redis não aceitou a publicação.' })
  @ZodResponse({ status: 201, type: EnfileirarDgpResponseDto })
  enqueueDgp(@Body() input: EnfileirarDgpDto) {
    return this.filasService.enqueueDgp(input);
  }

  @Get('lattes/jobs/ativos')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os jobs Lattes atualmente em processamento' })
  @ZodResponse({ status: 200, type: LattesJobsAtivosResponseDto })
  findActiveLattesJobs() {
    return this.filasService.findActiveLattesJobs();
  }

  @Get('lattes/jobs/:jobId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job Lattes' })
  @ApiParam({ name: 'jobId', example: 'lattes-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: LattesJobResponseDto })
  findLattesJob(@Param('jobId') jobId: string) {
    return this.filasService.findLattesJob(jobId);
  }

  @Post('lattes/jobs')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publica a coleta de um pesquisador na fila Lattes' })
  @ApiBadRequestResponse({ description: 'O ID Lattes deve conter exatamente 16 dígitos.' })
  @ApiNotFoundResponse({ description: 'Pesquisador não encontrado na fila de extração.' })
  @ApiConflictResponse({ description: 'Um job finalizado ainda aguarda reconciliação.' })
  @ApiServiceUnavailableResponse({ description: 'O manifesto foi salvo, mas o Redis não aceitou a publicação.' })
  @ZodResponse({ status: 201, type: EnfileirarLattesResponseDto })
  enqueueLattes(@Body() input: EnfileirarLattesDto) {
    return this.filasService.enqueueLattes(input);
  }

  @Get('discovery/jobs/ativos')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os jobs de descoberta DGP atualmente em processamento' })
  @ZodResponse({ status: 200, type: DiscoveryJobsAtivosResponseDto })
  findActiveDiscoveryJobs() {
    return this.filasService.findActiveDiscoveryJobs();
  }

  @Get('discovery/jobs/:jobId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job de descoberta DGP' })
  @ApiParam({ name: 'jobId', description: 'ID determinístico da chave na fila BullMQ.' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: DiscoveryJobResponseDto })
  findDiscoveryJob(@Param('jobId') jobId: string) {
    return this.filasService.findDiscoveryJob(jobId);
  }

  @Post('discovery/jobs')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publica uma chave e UF na fila de descoberta DGP' })
  @ApiBadRequestResponse({ description: 'A chave ou a UF informada é inválida.' })
  @ApiConflictResponse({ description: 'Um job finalizado ainda aguarda reconciliação.' })
  @ApiServiceUnavailableResponse({ description: 'O manifesto foi salvo, mas o Redis não aceitou a publicação.' })
  @ZodResponse({ status: 201, type: EnfileirarDiscoveryResponseDto })
  enqueueDiscovery(@Body() input: EnfileirarDiscoveryDto) {
    return this.filasService.enqueueDiscovery(input);
  }

  @Get('etl/grupos/jobs/ativos')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os jobs de ETL de grupos atualmente em processamento' })
  @ZodResponse({ status: 200, type: EtlGroupJobsAtivosResponseDto })
  findActiveEtlGroupJobs() {
    return this.filasService.findActiveEtlGroupJobs();
  }

  @Get('etl/grupos/jobs/:jobId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job de ETL de grupo' })
  @ApiParam({ name: 'jobId', example: 'etl-grupo-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: EtlGroupJobResponseDto })
  findEtlGroupJob(@Param('jobId') jobId: string) {
    return this.filasService.findEtlGroupJob(jobId);
  }

  @Get('etl/pesquisadores/jobs/ativos')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os jobs de ETL de pesquisadores atualmente em processamento' })
  @ZodResponse({ status: 200, type: EtlResearcherJobsAtivosResponseDto })
  findActiveEtlResearcherJobs() {
    return this.filasService.findActiveEtlResearcherJobs();
  }

  @Get('etl/pesquisadores/jobs/:jobId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job de ETL de pesquisador' })
  @ApiParam({ name: 'jobId', example: 'etl-pesquisador-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: EtlResearcherJobResponseDto })
  findEtlResearcherJob(@Param('jobId') jobId: string) {
    return this.filasService.findEtlResearcherJob(jobId);
  }

  @Post('etl/lotes')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicita um lote ETL no servidor que possui os arquivos JSON' })
  @ApiBadRequestResponse({ description: 'Tipo, escopo ou IDs inválidos.' })
  @ZodResponse({ status: 201, type: EnfileirarEtlResponseDto })
  enqueueEtl(@Body() input: EnfileirarEtlDto) {
    return this.filasService.enqueueEtl(input);
  }

  @Get('etl/lotes/:jobId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta o despacho que prepara e publica um lote ETL' })
  @ApiNotFoundResponse({ description: 'Pedido de ETL não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: EtlDispatchJobResponseDto })
  findEtlDispatchJob(@Param('jobId') jobId: string) {
    return this.filasService.findEtlDispatchJob(jobId);
  }

  // ==========================================
  // SYSTEM MAINTENANCE JOBS
  // ==========================================

  @Post('system/backup-db')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispara manualmente o backup do banco de dados' })
  @ApiBadRequestResponse({ description: 'Formato ou retenção inválidos.' })
  @ZodResponse({ status: 201, type: EnfileirarBackupDbResponseDto })
  enqueueBackupDb(@Body() input: EnfileirarBackupDbDto) {
    return this.filasService.enqueueBackupDb(input);
  }

  @Post('system/refresh-mv')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispara manualmente a atualização da view materializada' })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos.' })
  @ZodResponse({ status: 201, type: EnfileirarRefreshMvResponseDto })
  enqueueRefreshMv(@Body() input: EnfileirarRefreshMvDto) {
    return this.filasService.enqueueRefreshMv(input);
  }

  @Post('system/cleanup-logs')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispara manualmente a limpeza de logs antigos' })
  @ApiBadRequestResponse({ description: 'Retenção inválida.' })
  @ZodResponse({ status: 201, type: EnfileirarCleanupLogsResponseDto })
  enqueueCleanupLogs(@Body() input: EnfileirarCleanupLogsDto) {
    return this.filasService.enqueueCleanupLogs(input);
  }

  @Post('system/reconcile-stuck')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispara manualmente a reconciliação de filas presas' })
  @ApiBadRequestResponse({ description: 'Dias de inatividade inválidos.' })
  @ZodResponse({ status: 201, type: EnfileirarReconcileStuckQueuesResponseDto })
  enqueueReconcileStuckQueues(@Body() input: EnfileirarReconcileStuckQueuesDto) {
    return this.filasService.enqueueReconcileStuckQueues(input);
  }

  @Get('system/jobs/ativos')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os jobs de manutenção do sistema atualmente em processamento' })
  @ZodResponse({ status: 200, type: SystemMaintenanceJobsAtivosResponseDto })
  async findActiveSystemMaintenanceJobs(): Promise<SystemMaintenanceJobsAtivosResponse> {
    return this.filasService.findActiveSystemMaintenanceJobs();
  }

  @Get('system/jobs/:jobId')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job de manutenção' })
  @ApiParam({ name: 'jobId', example: 'backup-db-daily' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: SystemMaintenanceJobStatusDto })
  async findSystemMaintenanceJob(@Param('jobId') jobId: string): Promise<SystemMaintenanceJobStatus> {
    return this.filasService.findSystemMaintenanceJob(jobId);
  }

  @Get(':fila/jobs')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista todos os jobs de uma fila com paginação e filtros' })
  @ZodResponse({ status: 200, type: FilaJobsResponseDto })
  findQueueJobs(@Param() params: FilaParamDto, @Query() query: ConsultarFilaJobsDto) {
    return this.filasService.findQueueJobs(params.fila, query);
  }

  @Get(':fila')
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta pausa, workers e contadores de uma fila' })
  @ZodResponse({ status: 200, type: FilaResumoResponseDto })
  findQueue(@Param() params: FilaParamDto) {
    return this.filasService.findQueue(params.fila);
  }

  @Post(':fila/pausar')
  @HttpCode(200)
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pausa globalmente uma fila; jobs ativos terminam normalmente' })
  @ZodResponse({ status: 200, type: FilaResumoResponseDto })
  pauseQueue(@Param() params: FilaParamDto) {
    return this.filasService.pauseQueue(params.fila);
  }

  @Post(':fila/retomar')
  @HttpCode(200)
  @UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retoma globalmente o processamento de uma fila' })
  @ZodResponse({ status: 200, type: FilaResumoResponseDto })
  resumeQueue(@Param() params: FilaParamDto) {
    return this.filasService.resumeQueue(params.fila);
  }
}