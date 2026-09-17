import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
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
  LattesJobResponseDto,
  LattesJobsAtivosResponseDto,
  WorkerFilaResponseDto,
  WorkersAtivosResponseDto,
} from './dto/filas.dto';
import { FilasService } from './filas.service';
import { FilasJwtAuthGuard } from './filas-auth.guard';
import { FilasRedisGuard } from './filas-redis.guard';

@ApiTags('admin-filas')
@ApiBearerAuth()
@ApiServiceUnavailableResponse({ description: 'Filas temporariamente indisponiveis enquanto o Redis estiver fora do ar.' })
@UseGuards(FilasJwtAuthGuard, FilasRedisGuard)
@Controller('admin/filas')
export class FilasController {
  constructor(private readonly filasService: FilasService) {}

  @Get('workers')
  @ApiOperation({ summary: 'Lista os workers conectados às filas do pipeline' })
  @ZodResponse({ status: 200, type: WorkersAtivosResponseDto })
  findActiveWorkers() {
    return this.filasService.findActiveWorkers();
  }

  @Get('workers/:workerId')
  @ApiOperation({ summary: 'Consulta um worker conectado pelo ID da conexão Redis' })
  @ApiParam({ name: 'workerId', description: 'ID volátil da conexão; muda quando o worker reinicia.' })
  @ApiNotFoundResponse({ description: 'Worker não está ativo ou não existe.' })
  @ZodResponse({ status: 200, type: WorkerFilaResponseDto })
  findWorker(@Param('workerId') workerId: string) {
    return this.filasService.findWorker(workerId);
  }

  @Get('dgp/jobs/ativos')
  @ApiOperation({ summary: 'Lista os jobs DGP atualmente em processamento' })
  @ZodResponse({ status: 200, type: DgpJobsAtivosResponseDto })
  findActiveDgpJobs() {
    return this.filasService.findActiveDgpJobs();
  }

  @Get('dgp/jobs/:jobId')
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job DGP' })
  @ApiParam({ name: 'jobId', example: 'dgp-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: DgpJobResponseDto })
  findDgpJob(@Param('jobId') jobId: string) {
    return this.filasService.findDgpJob(jobId);
  }

  @Post('dgp/jobs')
  @ApiOperation({ summary: 'Publica a coleta de um grupo na fila DGP' })
  @ApiBadRequestResponse({ description: 'O ID DGP deve conter exatamente 16 dígitos.' })
  @ApiConflictResponse({ description: 'Um job finalizado ainda aguarda reconciliação.' })
  @ApiServiceUnavailableResponse({ description: 'O manifesto foi salvo, mas o Redis não aceitou a publicação.' })
  @ZodResponse({ status: 201, type: EnfileirarDgpResponseDto })
  enqueueDgp(@Body() input: EnfileirarDgpDto) {
    return this.filasService.enqueueDgp(input);
  }

  @Get('lattes/jobs/ativos')
  @ApiOperation({ summary: 'Lista os jobs Lattes atualmente em processamento' })
  @ZodResponse({ status: 200, type: LattesJobsAtivosResponseDto })
  findActiveLattesJobs() {
    return this.filasService.findActiveLattesJobs();
  }

  @Get('lattes/jobs/:jobId')
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job Lattes' })
  @ApiParam({ name: 'jobId', example: 'lattes-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: LattesJobResponseDto })
  findLattesJob(@Param('jobId') jobId: string) {
    return this.filasService.findLattesJob(jobId);
  }

  @Post('lattes/jobs')
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
  @ApiOperation({ summary: 'Lista os jobs de descoberta DGP atualmente em processamento' })
  @ZodResponse({ status: 200, type: DiscoveryJobsAtivosResponseDto })
  findActiveDiscoveryJobs() {
    return this.filasService.findActiveDiscoveryJobs();
  }

  @Get('discovery/jobs/:jobId')
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job de descoberta DGP' })
  @ApiParam({ name: 'jobId', description: 'ID determinístico da chave na fila BullMQ.' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: DiscoveryJobResponseDto })
  findDiscoveryJob(@Param('jobId') jobId: string) {
    return this.filasService.findDiscoveryJob(jobId);
  }

  @Post('discovery/jobs')
  @ApiOperation({ summary: 'Publica uma chave na fila de descoberta DGP' })
  @ApiBadRequestResponse({ description: 'A chave deve conter entre 1 e 100 caracteres.' })
  @ApiConflictResponse({ description: 'Um job finalizado ainda aguarda reconciliação.' })
  @ApiServiceUnavailableResponse({ description: 'O manifesto foi salvo, mas o Redis não aceitou a publicação.' })
  @ZodResponse({ status: 201, type: EnfileirarDiscoveryResponseDto })
  enqueueDiscovery(@Body() input: EnfileirarDiscoveryDto) {
    return this.filasService.enqueueDiscovery(input);
  }

  @Get('etl/grupos/jobs/ativos')
  @ApiOperation({ summary: 'Lista os jobs de ETL de grupos atualmente em processamento' })
  @ZodResponse({ status: 200, type: EtlGroupJobsAtivosResponseDto })
  findActiveEtlGroupJobs() {
    return this.filasService.findActiveEtlGroupJobs();
  }

  @Get('etl/grupos/jobs/:jobId')
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job de ETL de grupo' })
  @ApiParam({ name: 'jobId', example: 'etl-grupo-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: EtlGroupJobResponseDto })
  findEtlGroupJob(@Param('jobId') jobId: string) {
    return this.filasService.findEtlGroupJob(jobId);
  }

  @Get('etl/pesquisadores/jobs/ativos')
  @ApiOperation({ summary: 'Lista os jobs de ETL de pesquisadores atualmente em processamento' })
  @ZodResponse({ status: 200, type: EtlResearcherJobsAtivosResponseDto })
  findActiveEtlResearcherJobs() {
    return this.filasService.findActiveEtlResearcherJobs();
  }

  @Get('etl/pesquisadores/jobs/:jobId')
  @ApiOperation({ summary: 'Consulta o estado e o progresso de um job de ETL de pesquisador' })
  @ApiParam({ name: 'jobId', example: 'etl-pesquisador-1234567890123456' })
  @ApiNotFoundResponse({ description: 'Job não encontrado no Redis.' })
  @ZodResponse({ status: 200, type: EtlResearcherJobResponseDto })
  findEtlResearcherJob(@Param('jobId') jobId: string) {
    return this.filasService.findEtlResearcherJob(jobId);
  }
}
