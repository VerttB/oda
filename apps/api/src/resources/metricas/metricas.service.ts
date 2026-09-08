import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { FilaExtracaoStatus, TipoRelacaoGrupoInstituicao } from '@oda/database';
import { toGrupoPesquisaResponse } from '../grupos-pesquisa/grupos-pesquisa.response';

type PrismaGroupCount = {
  _count?: number | true | Record<string, number | undefined>;
};

const getGroupCount = (item: PrismaGroupCount, field: string) => {
  if (!item._count || item._count === true) {
    return 0;
  }

  if (typeof item._count === 'number') {
    return item._count;
  }

  return item._count[field] ?? item._count._all ?? 0;
};

const percentual = (parte: number, total: number) => {
  if (total === 0) {
    return 0;
  }

  return Number(((parte / total) * 100).toFixed(2));
};

@Injectable()
export class MetricasService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    const [
      gruposDePesquisa,
      pesquisadores,
      areasConhecimento,
      producoes,
      instituicoes,
      filasExtracao,
    ] = await Promise.all([
      this.findMetricasGruposPesquisa(),
      this.findMetricasPesquisadores(),
      this.findMetricasAreasConhecimento(),
      this.findMetricasProducoes(),
      this.findMetricasInstituicoes(),
      this.findMetricasFilasExtracao(),
    ]);

    return {
      gruposDePesquisa,
      pesquisadores,
      areasConhecimento,
      producoes,
      instituicoes,
      filasExtracao,
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
      include: {
        instituicoes: {
          include: {
            instituicao: {
              include: { estado: true },
            },
          },
        },
        areaConhecimento: true,
        areasConhecimento: { include: { area: true } },
      },
    });

    const [
      totalPesquisadores,
      totalPesquisadoresComLattes,
      totalLinhasPesquisa,
      totalAreasConhecimento,
      totalAreasPrincipais,
      totalAreasAdicionais,
      totalProducoes,
      totalProducoesComDoi,
      totalProducoesComQualis,
      totalInstituicoesParceiras,
      producoesPorAno,
      producoesPorTipo,
      producoesPorQualis,
      pesquisadoresPorTipo,
      pesquisadoresPorFormacao,
    ] = await this.prismaService.$transaction([
      this.prismaService.membroGrupo.count({ where: { grupoId: id } }),
      this.prismaService.membroGrupo.count({
        where: { grupoId: id, pesquisador: { lattesId: { not: null } } },
      }),
      this.prismaService.linhaPesquisa.count({ where: { grupoId: id } }),
      this.prismaService.grupoPesquisaAreaConhecimento.count({ where: { grupoId: id } }),
      this.prismaService.grupoPesquisaAreaConhecimento.count({
        where: { grupoId: id, relacao: 'PRINCIPAL' },
      }),
      this.prismaService.grupoPesquisaAreaConhecimento.count({
        where: { grupoId: id, relacao: 'ADICIONAL' },
      }),
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
      this.prismaService.producao.count({
        where: {
          doi: { not: null },
          autores: { some: { pesquisador: { membrosGrupo: { some: { grupoId: id } } } } },
        },
      }),
      this.prismaService.producao.count({
        where: {
          qualis: { not: null },
          autores: { some: { pesquisador: { membrosGrupo: { some: { grupoId: id } } } } },
        },
      }),
      this.prismaService.grupoPesquisaInstituicao.count({
        where: { grupoId: id, tipoRelacao: TipoRelacaoGrupoInstituicao.PARCEIRA },
      }),
      this.prismaService.producao.groupBy({
        by: ['ano'],
        where: {
          ano: { not: null },
          autores: { some: { pesquisador: { membrosGrupo: { some: { grupoId: id } } } } },
        },
        _count: { id: true },
        orderBy: { ano: 'asc' },
      }),
      this.prismaService.producao.groupBy({
        by: ['tipo'],
        where: {
          autores: { some: { pesquisador: { membrosGrupo: { some: { grupoId: id } } } } },
        },
        _count: { id: true },
        orderBy: { tipo: 'asc' },
      }),
      this.prismaService.producao.groupBy({
        by: ['qualis'],
        where: {
          qualis: { not: null },
          autores: { some: { pesquisador: { membrosGrupo: { some: { grupoId: id } } } } },
        },
        _count: { id: true },
        orderBy: { qualis: 'asc' },
      }),
      this.prismaService.pesquisador.groupBy({
        by: ['tipo'],
        where: { membrosGrupo: { some: { grupoId: id } } },
        _count: { id: true },
        orderBy: { tipo: 'asc' },
      }),
      this.prismaService.pesquisador.groupBy({
        by: ['formacaoAcademica'],
        where: { membrosGrupo: { some: { grupoId: id } } },
        _count: { id: true },
        orderBy: { formacaoAcademica: 'asc' },
      }),
    ]);

    return {
      grupo: toGrupoPesquisaResponse(grupo),
      totais: {
        pesquisadores: totalPesquisadores,
        pesquisadoresComLattes: totalPesquisadoresComLattes,
        linhasPesquisa: totalLinhasPesquisa,
        areasConhecimento: totalAreasConhecimento,
        areasConhecimentoPrincipais: totalAreasPrincipais,
        areasConhecimentoAdicionais: totalAreasAdicionais,
        producoes: totalProducoes,
        instituicoesParceiras: totalInstituicoesParceiras,
      },
      cobertura: {
        pesquisadoresComLattesPercentual: percentual(totalPesquisadoresComLattes, totalPesquisadores),
        producoesComDoi: totalProducoesComDoi,
        producoesComDoiPercentual: percentual(totalProducoesComDoi, totalProducoes),
        producoesComQualis: totalProducoesComQualis,
        producoesComQualisPercentual: percentual(totalProducoesComQualis, totalProducoes),
      },
      pesquisadoresPorTipo: pesquisadoresPorTipo.map((item) => ({
        tipo: item.tipo ?? 'NAO_INFORMADO',
        total: getGroupCount(item, 'id'),
      })),
      pesquisadoresPorFormacao: pesquisadoresPorFormacao.map((item) => ({
        formacao: item.formacaoAcademica ?? 'NAO_INFORMADA',
        total: getGroupCount(item, 'id'),
      })),
      producoesPorAno: producoesPorAno.map((item) => ({
        ano: item.ano,
        total: getGroupCount(item, 'id'),
      })),
      producoesPorTipo: producoesPorTipo.map((item) => ({
        tipo: item.tipo,
        total: getGroupCount(item, 'id'),
      })),
      producoesPorQualis: producoesPorQualis.map((item) => ({
        qualis: item.qualis,
        total: getGroupCount(item, 'id'),
      })),
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

  async findMetricasPesquisador(id: string) {
    const pesquisador = await this.prismaService.pesquisador.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        lattesId: true,
        nome: true,
        tipo: true,
        formacaoAcademica: true,
        orcidId: true,
        openAlexId: true,
        imageUrl: true,
        indexH: true,
        indexI10: true,
      },
    });

    const [
      totalGrupos,
      totalGruposComoLider,
      totalLinhasPesquisa,
      totalAreasConhecimento,
      totalProducoes,
      totalProducoesComDoi,
      totalProducoesComQualis,
      producoesPorTipo,
      producoesPorAno,
      producoesPorQualis,
    ] = await this.prismaService.$transaction([
      this.prismaService.membroGrupo.count({ where: { pesquisadorId: id } }),
      this.prismaService.membroGrupo.count({ where: { pesquisadorId: id, eLider: true } }),
      this.prismaService.membroLinhaPesquisa.count({ where: { pesquisadorId: id } }),
      this.prismaService.pesquisadoresAreaConhecimento.count({ where: { pesquisadorId: id } }),
      this.prismaService.producaoPesquisador.count({ where: { pesquisadorId: id } }),
      this.prismaService.producao.count({
        where: { doi: { not: null }, autores: { some: { pesquisadorId: id } } },
      }),
      this.prismaService.producao.count({
        where: { qualis: { not: null }, autores: { some: { pesquisadorId: id } } },
      }),
      this.prismaService.producao.groupBy({
        by: ['tipo'],
        where: {
          autores: {
            some: { pesquisadorId: id },
          },
        },
        _count: { id: true },
        orderBy: { tipo: 'asc' },
      }),
      this.prismaService.producao.groupBy({
        by: ['ano'],
        where: { ano: { not: null }, autores: { some: { pesquisadorId: id } } },
        _count: { id: true },
        orderBy: { ano: 'asc' },
      }),
      this.prismaService.producao.groupBy({
        by: ['qualis'],
        where: { qualis: { not: null }, autores: { some: { pesquisadorId: id } } },
        _count: { id: true },
        orderBy: { qualis: 'asc' },
      }),
    ]);

    return {
      pesquisador,
      totais: {
        grupos: totalGrupos,
        gruposComoLider: totalGruposComoLider,
        linhasPesquisa: totalLinhasPesquisa,
        areasConhecimento: totalAreasConhecimento,
        producoes: totalProducoes,
      },
      cobertura: {
        producoesComDoi: totalProducoesComDoi,
        producoesComDoiPercentual: percentual(totalProducoesComDoi, totalProducoes),
        producoesComQualis: totalProducoesComQualis,
        producoesComQualisPercentual: percentual(totalProducoesComQualis, totalProducoes),
      },
      producoesPorTipo: producoesPorTipo.map((item) => ({
        tipo: item.tipo,
        total: getGroupCount(item, 'id'),
      })),
      producoesPorAno: producoesPorAno.map((item) => ({
        ano: item.ano,
        total: getGroupCount(item, 'id'),
      })),
      producoesPorQualis: producoesPorQualis.map((item) => ({
        qualis: item.qualis,
        total: getGroupCount(item, 'id'),
      })),
    };
  }

  async findMetricasAreasConhecimento() {
    const [
      total,
      totalRaizes,
      totalComPai,
      totalMapeadasOpenAlex,
      cnpqPorTipo,
      openAlexPorTipo,
      mapeamentosPorStatus,
      gruposAreasPorRelacao,
      gruposAreasPorMetodo,
      gruposComAreaPrincipal,
    ] = await this.prismaService.$transaction([
      this.prismaService.areaConhecimento.count(),
      this.prismaService.areaConhecimento.count({ where: { areaPaiId: null } }),
      this.prismaService.areaConhecimento.count({ where: { areaPaiId: { not: null } } }),
      this.prismaService.areaConhecimento.count({
        where: { mapeamentosOpenAlex: { some: {} } },
      }),
      this.prismaService.areaConhecimento.groupBy({
        by: ['tipo'],
        _count: { id: true },
        orderBy: { tipo: 'asc' },
      }),
      this.prismaService.openAlexAreaConhecimento.groupBy({
        by: ['tipo'],
        _count: { id: true },
        orderBy: { tipo: 'asc' },
      }),
      this.prismaService.mapeamentoAreaTaxonomia.groupBy({
        by: ['status'],
        _count: { id: true },
        orderBy: { status: 'asc' },
      }),
      this.prismaService.grupoPesquisaAreaConhecimento.groupBy({
        by: ['relacao'],
        _count: { grupoId: true },
        orderBy: { relacao: 'asc' },
      }),
      this.prismaService.grupoPesquisaAreaConhecimento.groupBy({
        by: ['metodoInferencia'],
        _count: { grupoId: true },
        orderBy: { metodoInferencia: 'asc' },
      }),
      this.prismaService.grupoPesquisa.count({
        where: { areaConhecimentoId: { not: null } },
      }),
    ]);

    return {
      total,
      raizes: totalRaizes,
      comAreaPai: totalComPai,
      gruposComAreaPrincipal,
      mapeadasOpenAlex: totalMapeadasOpenAlex,
      mapeadasOpenAlexPercentual: percentual(totalMapeadasOpenAlex, total),
      cnpqPorTipo: cnpqPorTipo.map((item) => ({
        tipo: item.tipo ?? 'NAO_INFORMADO',
        total: getGroupCount(item, 'id'),
      })),
      openAlexPorTipo: openAlexPorTipo.map((item) => ({
        tipo: item.tipo,
        total: getGroupCount(item, 'id'),
      })),
      gruposAreasPorRelacao: gruposAreasPorRelacao.map((item) => ({
        relacao: item.relacao,
        total: getGroupCount(item, 'grupoId'),
      })),
      gruposAreasPorMetodo: gruposAreasPorMetodo.map((item) => ({
        metodoInferencia: item.metodoInferencia,
        total: getGroupCount(item, 'grupoId'),
      })),
      mapeamentosPorStatus: mapeamentosPorStatus.map((item) => ({
        status: item.status,
        total: getGroupCount(item, 'id'),
      })),
    };
  }

  async findMetricasProducoes() {
    const [
      total,
      doiNulos,
      qualisNulos,
      issnNulos,
      resumoNulos,
      urlNulos,
      totalPorQualis,
      totalPorTipo,
      totalPorAno,
    ] = await this.prismaService.$transaction([
      this.prismaService.producao.count(),
      this.prismaService.producao.count({ where: { doi: null } }),
      this.prismaService.producao.count({ where: { qualis: null } }),
      this.prismaService.producao.count({ where: { issn: null } }),
      this.prismaService.producao.count({ where: { resumo: null } }),
      this.prismaService.producao.count({ where: { url: null } }),
      this.prismaService.producao.groupBy({
        by: ['qualis'],
        where: {
          qualis: { not: null },
        },
        _count: { id: true },
        orderBy: { qualis: 'asc' },
      }),
      this.prismaService.producao.groupBy({
        by: ['tipo'],
        _count: { id: true },
        orderBy: { tipo: 'asc' },
      }),
      this.prismaService.producao.groupBy({
        by: ['ano'],
        where: { ano: { not: null } },
        _count: { id: true },
        orderBy: { ano: 'asc' },
      }),
    ]);

    return {
      total,
      valoresNulos: {
        doi: doiNulos,
        resumo: resumoNulos,
        issn: issnNulos,
        qualis: qualisNulos,
        url: urlNulos,
      },
      cobertura: {
        doiPercentual: percentual(total - doiNulos, total),
        resumoPercentual: percentual(total - resumoNulos, total),
        issnPercentual: percentual(total - issnNulos, total),
        qualisPercentual: percentual(total - qualisNulos, total),
        urlPercentual: percentual(total - urlNulos, total),
      },
      totalPorQualis: totalPorQualis.map((item) => ({
        qualis: item.qualis,
        total: getGroupCount(item, 'id'),
      })),
      totalPorTipo: totalPorTipo.map((item) => ({
        tipo: item.tipo,
        total: getGroupCount(item, 'id'),
      })),
      totalPorAno: totalPorAno.map((item) => ({
        ano: item.ano,
        total: getGroupCount(item, 'id'),
      })),
    };
  }

  async findMetricasInstituicoes() {
    const [
      total,
      totalSemUf,
      totalPorEstadoId,
      estados,
      vinculosSede,
      vinculosParceria,
      instituicoesComSede,
      instituicoesComParceria,
    ] = await this.prismaService.$transaction([
      this.prismaService.instituicao.count(),
      this.prismaService.instituicao.count({ where: { estadoId: null } }),
      this.prismaService.instituicao.groupBy({
        by: ['estadoId'],
        where: { estadoId: { not: null } },
        _count: { id: true },
        orderBy: { estadoId: 'asc' },
      }),
      this.prismaService.estado.findMany({
        select: { id: true, nome: true, sigla: true, regiao: true },
      }),
      this.prismaService.grupoPesquisaInstituicao.count({
        where: { tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE },
      }),
      this.prismaService.grupoPesquisaInstituicao.count({
        where: { tipoRelacao: TipoRelacaoGrupoInstituicao.PARCEIRA },
      }),
      this.prismaService.instituicao.count({
        where: { gruposPesquisaVinculos: { some: { tipoRelacao: TipoRelacaoGrupoInstituicao.SEDE } } },
      }),
      this.prismaService.instituicao.count({
        where: { gruposPesquisaVinculos: { some: { tipoRelacao: TipoRelacaoGrupoInstituicao.PARCEIRA } } },
      }),
    ]);

    const estadosPorId = new Map(estados.map((estado) => [estado.id, estado]));

    return {
      total,
      semUf: totalSemUf,
      porUf: totalPorEstadoId.map((item) => {
        const estado = item.estadoId ? estadosPorId.get(item.estadoId) : null;

        return {
          uf: estado?.sigla ?? 'SEM_UF',
          estado: estado?.nome ?? null,
          regiao: estado?.regiao ?? null,
          total: getGroupCount(item, 'id'),
        };
      }),
      vinculosComGrupos: {
        sede: vinculosSede,
        parceira: vinculosParceria,
      },
      instituicoesComGrupos: {
        sede: instituicoesComSede,
        parceira: instituicoesComParceria,
      },
    };
  }

  async findMetricasFilasExtracao() {
    const [gruposPorStatus, pesquisadoresPorStatus, gruposComErro, pesquisadoresComErro] =
      await this.prismaService.$transaction([
        this.prismaService.filaExtracaoGrupo.groupBy({
          by: ['status'],
          _count: { dgpId: true },
          orderBy: { status: 'asc' },
        }),
        this.prismaService.filaExtracaoPesquisador.groupBy({
          by: ['status'],
          _count: { lattesId: true },
          orderBy: { status: 'asc' },
        }),
        this.prismaService.filaExtracaoGrupo.count({
          where: { status: FilaExtracaoStatus.ERRO },
        }),
        this.prismaService.filaExtracaoPesquisador.count({
          where: { status: FilaExtracaoStatus.ERRO },
        }),
      ]);

    return {
      gruposPesquisa: {
        comErro: gruposComErro,
        porStatus: gruposPorStatus.map((item) => ({
          status: item.status,
          total: getGroupCount(item, 'dgpId'),
        })),
      },
      pesquisadores: {
        comErro: pesquisadoresComErro,
        porStatus: pesquisadoresPorStatus.map((item) => ({
          status: item.status,
          total: getGroupCount(item, 'lattesId'),
        })),
      },
    };
  }
}
