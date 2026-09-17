import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JOB_NAMES } from '@oda/queue';
import {
  DgpJobsAtivosResponseSchema, DiscoveryJobsAtivosResponseSchema,
  EtlGroupJobsAtivosResponseSchema, EtlResearcherJobsAtivosResponseSchema,
  LattesJobsAtivosResponseSchema,
} from '@oda/shared-types';
import { omitAuditFields } from '../../common/interceptors/omit-audit-fields.interceptor';
import { FilasService } from './filas.service';

function validJob(dgpId = '1234567890123456') {
  return {
    version: 1 as const,
    dgpId,
    requestedAt: new Date().toISOString(),
    pipelineLogId: randomUUID(),
    pipelineItemId: randomUUID(),
  };
}

function validLattesJob(lattesId = '1234567890123456') {
  return {
    version: 1 as const,
    lattesId,
    nome: 'Pesquisador Teste',
    requestedAt: new Date().toISOString(),
    pipelineLogId: randomUUID(),
    pipelineItemId: randomUUID(),
  };
}

function validDiscoveryJob(chave = 'computacao') {
  return {
    version: 1 as const,
    chave,
    requestedAt: new Date().toISOString(),
    pipelineLogId: randomUUID(),
    pipelineItemId: randomUUID(),
  };
}

function validEtlGroupJob(dgpId = '1234567890123456') {
  return {
    version: 1 as const, dgpId, arquivoJson: `${dgpId}.json`, tamanhoBytes: 100,
    hashArquivo: 'a'.repeat(64), requestedAt: new Date().toISOString(),
    pipelineLogId: randomUUID(), pipelineItemId: randomUUID(),
  };
}

function validEtlResearcherJob(lattesId = '1234567890123456') {
  return {
    version: 1 as const, lattesId, arquivoJson: `${lattesId}.json`, tamanhoBytes: 200,
    hashArquivo: 'b'.repeat(64), requestedAt: new Date().toISOString(),
    pipelineLogId: randomUUID(), pipelineItemId: randomUUID(),
  };
}

function queueMock(expectedJobName: string) {
  let storedJob: any = null;
  const queue = {
    getWorkers: jest.fn().mockResolvedValue([]),
    getJobs: jest.fn().mockResolvedValue([]),
    getJob: jest.fn().mockImplementation(async () => storedJob),
    add: jest.fn().mockImplementation(async (name, data, options) => {
      expect(name).toBe(expectedJobName);
      storedJob = {
        id: options.jobId,
        data,
        getState: jest.fn().mockResolvedValue('waiting'),
        remove: jest.fn(),
      };
      return storedJob;
    }),
    close: jest.fn(),
  };
  return { queue, setStoredJob: (job: any) => { storedJob = job; } };
}

function setup() {
  const dgp = queueMock(JOB_NAMES.SCRAPE_DGP_GROUP);
  const lattes = queueMock(JOB_NAMES.SCRAPE_LATTES_RESEARCHER);
  const discovery = queueMock(JOB_NAMES.DISCOVER_DGP_GROUPS);
  const etlGroups = queueMock(JOB_NAMES.ETL_GROUP);
  const etlResearchers = queueMock(JOB_NAMES.ETL_RESEARCHER);
  const prisma = {
    filaExtracaoGrupo: { upsert: jest.fn().mockResolvedValue({}) },
    filaExtracaoPesquisador: {
      findUnique: jest.fn().mockResolvedValue({ lattesId: '1234567890123456', nome: 'Pesquisador Teste' }),
    },
    pipelineLogItem: { findUnique: jest.fn().mockResolvedValue(null) },
    pipelineLog: {
      create: jest.fn().mockImplementation(async ({ data }) => ({ ...data, dataInicio: new Date() })),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    queue: dgp.queue,
    lattesQueue: lattes.queue,
    discoveryQueue: discovery.queue,
    prisma,
    etlGroupQueue: etlGroups.queue,
    etlResearcherQueue: etlResearchers.queue,
    service: new FilasService(
      dgp.queue as any, lattes.queue as any, discovery.queue as any,
      etlGroups.queue as any, etlResearchers.queue as any, prisma as any,
    ),
    setStoredJob: dgp.setStoredJob,
    setStoredLattesJob: lattes.setStoredJob,
    setStoredDiscoveryJob: discovery.setStoredJob,
    setStoredEtlGroupJob: etlGroups.setStoredJob,
    setStoredEtlResearcherJob: etlResearchers.setStoredJob,
  };
}

describe('FilasService', () => {
  it('lista workers conectados e consulta um deles pelo ID Redis', async () => {
    const context = setup();
    context.queue.getWorkers.mockResolvedValue([{
      id: '41', name: 'bull:queue:w:dgp-local-123', addr: '127.0.0.1:5000', age: '12', idle: '2',
    }]);

    await expect(context.service.findActiveWorkers()).resolves.toEqual({
      total: 1,
      workers: [{
        id: '41', fila: 'dgp', status: 'ATIVO', nome: 'dgp-local-123',
        endereco: '127.0.0.1:5000', conectadoHaSegundos: 12, conexaoOciosaHaSegundos: 2,
      }],
    });
    await expect(context.service.findWorker('41')).resolves.toMatchObject({ id: '41', status: 'ATIVO' });
    await expect(context.service.findWorker('ausente')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('retorna o job existente sem criar outro pipeline', async () => {
    const context = setup();
    const data = validJob();
    context.setStoredJob({
      id: `dgp-${data.dgpId}`,
      data,
      getState: jest.fn().mockResolvedValue('active'),
    });

    await expect(context.service.enqueueDgp({ dgpId: data.dgpId })).resolves.toEqual({
      fila: 'dgp', jobId: `dgp-${data.dgpId}`, pipelineLogId: data.pipelineLogId,
      estado: 'active', duplicado: true,
    });
    expect(context.queue.add).not.toHaveBeenCalled();
    expect(context.prisma.pipelineLog.create).not.toHaveBeenCalled();
  });

  it('lista o job ativo com worker, tentativa e progresso estruturado', async () => {
    const context = setup();
    const data = validJob();
    const job = {
      id: `dgp-${data.dgpId}`,
      data,
      progress: {
        etapa: 'RECURSOS_HUMANOS', percentual: 35,
        itensProcessados: 2, itensTotal: 8,
        atualizadoEm: '2026-09-10T12:01:00.000Z',
      },
      processedBy: 'dgp-local',
      attemptsStarted: 2,
      opts: { attempts: 4 },
      timestamp: Date.parse('2026-09-10T12:00:00.000Z'),
      processedOn: Date.parse('2026-09-10T12:00:30.000Z'),
      finishedOn: undefined,
      failedReason: '',
      getState: jest.fn().mockResolvedValue('active'),
    };
    context.queue.getJobs.mockResolvedValue([job]);
    context.setStoredJob(job);

    const expected = {
      fila: 'dgp', jobId: job.id, dgpId: data.dgpId, pipelineLogId: data.pipelineLogId,
      estado: 'active', worker: 'dgp-local', tentativaAtual: 2, tentativasMaximas: 4,
      iniciadoEm: '2026-09-10T12:00:30.000Z',
      finalizadoEm: null, ultimoErro: null,
      progresso: {
        etapa: 'RECURSOS_HUMANOS', percentual: 35,
        itensProcessados: 2, itensTotal: 8,
        progressoEm: '2026-09-10T12:01:00.000Z',
      },
    };
    const activeResponse = await context.service.findActiveDgpJobs();
    expect(activeResponse).toEqual({ total: 1, jobs: [expected] });
    expect(DgpJobsAtivosResponseSchema.safeParse(omitAuditFields(activeResponse)).success).toBe(true);
    await expect(context.service.findDgpJob(job.id)).resolves.toEqual(expected);
    expect(context.queue.getJobs).toHaveBeenCalledWith(['active'], 0, -1, true);
  });

  it('retorna 404 ao consultar um job removido do Redis', async () => {
    const context = setup();
    await expect(context.service.findDgpJob('dgp-ausente')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cria manifesto, publica e confirma um novo job DGP', async () => {
    const context = setup();
    const response = await context.service.enqueueDgp({ dgpId: '1234567890123456' });

    expect(response).toMatchObject({
      fila: 'dgp', jobId: 'dgp-1234567890123456', estado: 'waiting', duplicado: false,
    });
    expect(context.prisma.filaExtracaoGrupo.upsert).toHaveBeenCalledTimes(1);
    expect(context.prisma.pipelineLog.create).toHaveBeenCalledTimes(1);
    expect(context.prisma.pipelineLog.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: response.pipelineLogId },
    }));
  });

  it('mantem manifesto aberto quando o Redis rejeita a publicacao', async () => {
    const context = setup();
    context.queue.add.mockRejectedValueOnce(new Error('Redis indisponivel'));

    await expect(context.service.enqueueDgp({ dgpId: '1234567890123456' }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(context.prisma.pipelineLog.create).toHaveBeenCalledTimes(1);
    expect(context.prisma.pipelineLog.update).not.toHaveBeenCalled();
  });

  it('impede republicacao de job terminal sem resultado conciliado', async () => {
    const context = setup();
    const data = validJob();
    context.setStoredJob({
      id: `dgp-${data.dgpId}`,
      data,
      getState: jest.fn().mockResolvedValue('failed'),
      remove: jest.fn(),
    });

    await expect(context.service.enqueueDgp({ dgpId: data.dgpId }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(context.queue.add).not.toHaveBeenCalled();
  });

  it('publica pesquisador existente e retorna progresso Lattes estruturado', async () => {
    const context = setup();
    const response = await context.service.enqueueLattes({ lattesId: '1234567890123456' });
    expect(response).toMatchObject({ fila: 'lattes', jobId: 'lattes-1234567890123456', duplicado: false });
    expect(context.prisma.filaExtracaoPesquisador.findUnique).toHaveBeenCalledTimes(1);

    const data = validLattesJob();
    const job = {
      id: `lattes-${data.lattesId}`, data,
      progress: { etapa: 'EXTRAINDO_CURRICULO', percentual: 65, paginaAtual: 1, paginasTotal: 2, progressoEm: '2026-09-11T12:00:00.000Z' },
      processedBy: 'lattes-local', attemptsStarted: 1, opts: { attempts: 4 },
      timestamp: Date.parse('2026-09-11T11:59:00.000Z'), processedOn: Date.parse('2026-09-11T11:59:30.000Z'),
      getState: jest.fn().mockResolvedValue('active'),
    };
    context.lattesQueue.getJobs.mockResolvedValue([job]);
    const active = await context.service.findActiveLattesJobs();
    expect(active).toMatchObject({ total: 1, jobs: [{ fila: 'lattes', lattesId: data.lattesId, progresso: { percentual: 65 } }] });
    expect(LattesJobsAtivosResponseSchema.safeParse(active).success).toBe(true);
  });

  it('publica chave de descoberta e expõe contadores do job ativo', async () => {
    const context = setup();
    const response = await context.service.enqueueDiscovery({ chave: 'computacao' });
    expect(response).toMatchObject({ fila: 'discovery', duplicado: false });

    const data = validDiscoveryJob();
    const job = {
      id: response.jobId, data,
      progress: {
        etapa: 'PROCESSANDO_PAGINAS', percentual: null, paginasProcessadas: 3,
        itensDescobertos: 120, itensPulados: 4, itensComErro: 0, progressoEm: '2026-09-11T12:00:00.000Z',
      },
      processedBy: 'discovery-local', attemptsStarted: 1, opts: { attempts: 4 }, timestamp: Date.now(),
      getState: jest.fn().mockResolvedValue('active'),
    };
    context.discoveryQueue.getJobs.mockResolvedValue([job]);
    const active = await context.service.findActiveDiscoveryJobs();
    expect(active).toMatchObject({ total: 1, jobs: [{ fila: 'discovery', chave: 'computacao', progresso: { paginasProcessadas: 3 } }] });
    expect(DiscoveryJobsAtivosResponseSchema.safeParse(active).success).toBe(true);
  });

  it('expõe progresso dos jobs ETL de grupo e pesquisador', async () => {
    const context = setup();
    const groupData = validEtlGroupJob();
    const researcherData = validEtlResearcherJob();
    const groupJob = {
      id: `etl-grupo-${groupData.dgpId}`, data: groupData,
      progress: {
        etapa: 'SALVANDO_PESQUISADORES', percentual: 75,
        itensProcessados: 10, itensTotal: 20, progressoEm: '2026-09-11T12:00:00.000Z',
      },
      processedBy: 'etl-grupos-local', attemptsStarted: 1, opts: { attempts: 4 }, timestamp: Date.now(),
      getState: jest.fn().mockResolvedValue('active'),
    };
    const researcherJob = {
      id: `etl-pesquisador-${researcherData.lattesId}`, data: researcherData,
      progress: {
        etapa: 'SALVANDO_PRODUCOES', percentual: 80, itensProcessados: 40, itensTotal: 60,
        loteAtual: 2, lotesTotal: 3, progressoEm: '2026-09-11T12:00:00.000Z',
      },
      processedBy: 'etl-pesquisadores-local', attemptsStarted: 1, opts: { attempts: 4 }, timestamp: Date.now(),
      getState: jest.fn().mockResolvedValue('active'),
    };
    context.etlGroupQueue.getJobs.mockResolvedValue([groupJob]);
    context.etlResearcherQueue.getJobs.mockResolvedValue([researcherJob]);

    const groups = await context.service.findActiveEtlGroupJobs();
    const researchers = await context.service.findActiveEtlResearcherJobs();
    expect(groups).toMatchObject({ total: 1, jobs: [{ fila: 'etl-grupos', progresso: { percentual: 75 } }] });
    expect(researchers).toMatchObject({ total: 1, jobs: [{ fila: 'etl-pesquisadores', progresso: { loteAtual: 2 } }] });
    expect(EtlGroupJobsAtivosResponseSchema.safeParse(groups).success).toBe(true);
    expect(EtlResearcherJobsAtivosResponseSchema.safeParse(researchers).success).toBe(true);

    context.setStoredEtlGroupJob(groupJob);
    context.setStoredEtlResearcherJob(researcherJob);
    await expect(context.service.findEtlGroupJob(`etl-grupo-${groupData.dgpId}`)).resolves.toMatchObject({ dgpId: groupData.dgpId });
    await expect(context.service.findEtlResearcherJob(`etl-pesquisador-${researcherData.lattesId}`)).resolves.toMatchObject({ lattesId: researcherData.lattesId });
  });
});
