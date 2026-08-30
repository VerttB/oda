import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TipoRelacaoGrupoInstituicao } from '@oda/database';

type PrismaGroupCount = {
  _count?: true | Record<string, number | undefined>;
};

const getGroupCount = (item: PrismaGroupCount, field: string) => {
  if (!item._count || item._count === true) {
    return 0;
  }

  return item._count[field] ?? item._count._all ?? 0;
};

@Injectable()
export class MetricasService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    const [gruposDePesquisa, pesquisadores] = await Promise.all([
      this.findMetricasGruposPesquisa(),
      this.findMetricasPesquisadores(),
    ]);

    return {
      gruposDePesquisa,
      pesquisadores,
    };
  }

  async findMetricasGruposPesquisa() {
    const [
      total,
      porUf,
      vinculosPorInstituicao,
      vinculosPorInstituicaoTipo,
      instituicoes,
    ] = await this.prismaService.$transaction([
      this.prismaService.grupoPesquisa.count(),
      this.prismaService.grupoPesquisa.groupBy({
        by: ['uf'],
        _count: { id: true },
        orderBy: { uf: 'asc' },
      }),
      this.prismaService.grupoPesquisaInstituicao.groupBy({
        by: ['instituicaoId'],
        _count: { grupoId: true },
        orderBy: { instituicaoId: 'asc' },
      }),
      this.prismaService.grupoPesquisaInstituicao.groupBy({
        by: ['instituicaoId', 'tipoRelacao'],
        _count: { grupoId: true },
        orderBy: [{ instituicaoId: 'asc' }, { tipoRelacao: 'asc' }],
      }),
      this.prismaService.instituicao.findMany({
        select: {
          id: true,
          nome: true,
          sigla: true,
          estado: { select: { sigla: true, nome: true } },
        },
      }),
    ]);

    const totaisPorTipo = new Map(
      vinculosPorInstituicaoTipo.map((item) => [
        `${item.instituicaoId}:${item.tipoRelacao}`,
        getGroupCount(item, 'grupoId'),
      ]),
    );

    const instituicoesPorId = new Map(
      instituicoes.map((instituicao) => [instituicao.id, instituicao]),
    );

    return {
      total,
      porUf: porUf.map((item) => ({
        uf: item.uf ?? 'SEM_UF',
        total: getGroupCount(item, 'id'),
      })),
      porInstituicao: vinculosPorInstituicao
        .map((item) => {
          const instituicao = instituicoesPorId.get(item.instituicaoId);

          return {
            instituicaoId: item.instituicaoId,
            nome: instituicao?.nome ?? null,
            sigla: instituicao?.sigla ?? null,
            uf: instituicao?.estado?.sigla ?? null,
            total: getGroupCount(item, 'grupoId'),
            sede: totaisPorTipo.get(`${item.instituicaoId}:${TipoRelacaoGrupoInstituicao.SEDE}`) ?? 0,
            parceira:
              totaisPorTipo.get(`${item.instituicaoId}:${TipoRelacaoGrupoInstituicao.PARCEIRA}`) ?? 0,
          };
        })
        .sort((a, b) => b.total - a.total),
    };
  }

  async findMetricasGrupoPesquisa(id: string) {
    const grupo = await this.prismaService.grupoPesquisa.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        dgpId: true,
        nome: true,
        instituicoes: {
          include: {
            instituicao: {
              select: {
                id: true,
                nome: true,
                sigla: true,
                estado: { select: { sigla: true, nome: true } },
              },
            },
          },
        },
      },
    });

    const [
      totalPesquisadores,
      totalPesquisadoresComLattes,
      totalLinhasPesquisa,
      totalAreasConhecimento,
      totalProducoes,
    ] = await this.prismaService.$transaction([
      this.prismaService.membroGrupo.count({ where: { grupoId: id } }),
      this.prismaService.membroGrupo.count({
        where: { grupoId: id, pesquisador: { lattesId: { not: null } } },
      }),
      this.prismaService.linhaPesquisa.count({ where: { grupoId: id } }),
      this.prismaService.grupoPesquisaAreaConhecimento.count({ where: { grupoId: id } }),
      this.prismaService.producao.count({
        where: {
          autores: {
            some: {
              pesquisador: {
                membrosGrupo: {
                  some: { grupoId: id },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      grupo,
      totais: {
        pesquisadores: totalPesquisadores,
        pesquisadoresComLattes: totalPesquisadoresComLattes,
        linhasPesquisa: totalLinhasPesquisa,
        areasConhecimento: totalAreasConhecimento,
        producoes: totalProducoes,
      },
    };
  }

  async findMetricasPesquisadores() {
    const [totalPesquisadores, porFormacao, porTipo, totalComOrcid] =
      await this.prismaService.$transaction([
      this.prismaService.pesquisador.count(),

      this.prismaService.pesquisador.groupBy({
        by: ['formacaoAcademica'],
        _count: { id: true },
        orderBy: { formacaoAcademica: 'asc' },
      }),

      this.prismaService.pesquisador.groupBy({
        by: ['tipo'],
        _count: { id: true },
        orderBy: { tipo: 'asc' },
      }),

      this.prismaService.pesquisador.count({
        where: { orcidId: { not: null } },
      }),
    ]);

    return {
      totalPesquisadores,
      totalComOrcid,
      porFormacao: porFormacao.map((item) => ({
        formacao: item.formacaoAcademica ?? 'NAO_INFORMADA',
        total: getGroupCount(item, 'id'),
      })),
      porTipo: porTipo.map((item) => ({
        tipo: item.tipo ?? 'NAO_INFORMADO',
        total: getGroupCount(item, 'id'),
      })),
    };
  }
}
