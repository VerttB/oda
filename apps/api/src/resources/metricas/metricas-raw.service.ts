import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { toGrupoPesquisaResponse } from '../grupos-pesquisa/grupos-pesquisa.response';

type JsonRows<T> = T[];
type GroupMetrics = {
  totalPesquisadores: number;
  totalPesquisadoresComLattes: number;
  totalLinhasPesquisa: number;
  totalAreasConhecimento: number;
  totalAreasPrincipais: number;
  totalAreasAdicionais: number;
  totalProducoes: number;
  totalProducoesComDoi: number;
  totalProducoesComQualis: number;
  totalInstituicoesParceiras: number;
  pesquisadoresPorTipo: JsonRows<{ tipo: string; total: number }>;
  pesquisadoresPorFormacao: JsonRows<{ formacao: string; total: number }>;
  producoesPorAno: JsonRows<{ ano: number; total: number }>;
  producoesPorTipo: JsonRows<{ tipo: string; total: number }>;
  producoesPorQualis: JsonRows<{ qualis: string; total: number }>;
};
type ResearcherMetrics = {
  totalGrupos: number;
  totalGruposComoLider: number;
  totalLinhasPesquisa: number;
  totalAreasConhecimento: number;
  totalProducoes: number;
  totalProducoesComDoi: number;
  totalProducoesComQualis: number;
  producoesPorTipo: JsonRows<{ tipo: string; total: number }>;
  producoesPorAno: JsonRows<{ ano: number; total: number }>;
  producoesPorQualis: JsonRows<{ qualis: string; total: number }>;
};
const percent = (part: number, total: number) => total ? Number(((part / total) * 100).toFixed(2)) : 0;
const array = <T>(value: T[] | null | undefined): T[] => value ?? [];

@Injectable()
export class MetricasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const [gruposDePesquisa, pesquisadores, areasConhecimento, producoes, instituicoes, filasExtracao] =
      await Promise.all([
        this.findMetricasGruposPesquisa(),
        this.findMetricasPesquisadores(),
        this.findMetricasAreasConhecimento(),
        this.findMetricasProducoes(),
        this.findMetricasInstituicoes(),
        this.findMetricasFilasExtracao(),
      ]);
    return { gruposDePesquisa, pesquisadores, areasConhecimento, producoes, instituicoes, filasExtracao };
  }

  async findMetricasGruposPesquisa() {
    const [r] = await this.prisma.$queryRaw<Array<{
      total: number;
      porUf: JsonRows<{ uf: string; total: number }>;
      porInstituicao: JsonRows<{
        instituicaoId: string; nome: string | null; sigla: string | null; uf: string | null;
        total: number; sede: number; parceira: number;
      }>;
    }>>`
      SELECT
        (SELECT COUNT(*)::int FROM grupo_pesquisa) AS total,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('uf', COALESCE(uf, 'SEM_UF'), 'total', n) ORDER BY uf NULLS FIRST)
          FROM (SELECT uf, COUNT(*)::int AS n FROM grupo_pesquisa GROUP BY uf) q
        ), '[]'::jsonb) AS "porUf",
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'instituicaoId', i.id, 'nome', i.nome, 'sigla', i.sigla, 'uf', e.sigla,
            'total', q.n, 'sede', q.sede, 'parceira', q.parceira
          ) ORDER BY q.n DESC)
          FROM (
            SELECT instituicao_id, COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE tipo_relacao = 'sede')::int AS sede,
              COUNT(*) FILTER (WHERE tipo_relacao = 'parceira')::int AS parceira
            FROM grupo_pesquisa_instituicao GROUP BY instituicao_id
          ) q
          JOIN instituicao i ON i.id = q.instituicao_id
          LEFT JOIN estado e ON e.id = i.estado_id
        ), '[]'::jsonb) AS "porInstituicao"
    `;
    return { total: r.total, porUf: array(r.porUf), porInstituicao: array(r.porInstituicao) };
  }

  async findMetricasGrupoPesquisa(id: string) {
    const grupo = await this.prisma.grupoPesquisa.findUniqueOrThrow({
      where: { id },
      include: {
        instituicoes: { include: { instituicao: { include: { estado: true } } } },
        areaConhecimento: true,
        areasConhecimento: { include: { area: true } },
      },
    });
    const [m] = await this.prisma.$queryRaw<GroupMetrics[]>`
      WITH pesquisadores_grupo AS (
        SELECT DISTINCT pesquisador_id FROM membro_grupo WHERE grupo_id = ${id}
      ),
      producoes_grupo AS (
        SELECT DISTINCT p.id, p.tipo, p.ano, p.qualis, p.doi
        FROM producao p
        JOIN producao_pesquisador pp ON pp.producao_id = p.id
        JOIN pesquisadores_grupo pg ON pg.pesquisador_id = pp.pesquisador_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM membro_grupo WHERE grupo_id = ${id}) AS "totalPesquisadores",
        (SELECT COUNT(*)::int FROM membro_grupo mg JOIN pesquisador p ON p.id = mg.pesquisador_id
          WHERE mg.grupo_id = ${id} AND p.lattes_id IS NOT NULL) AS "totalPesquisadoresComLattes",
        (SELECT COUNT(*)::int FROM linha_pesquisa WHERE grupo_id = ${id}) AS "totalLinhasPesquisa",
        (SELECT COUNT(*)::int FROM grupo_pesquisa_area_conhecimento WHERE grupo_id = ${id}) AS "totalAreasConhecimento",
        (SELECT COUNT(*)::int FROM grupo_pesquisa_area_conhecimento WHERE grupo_id = ${id} AND relacao = 'PRINCIPAL') AS "totalAreasPrincipais",
        (SELECT COUNT(*)::int FROM grupo_pesquisa_area_conhecimento WHERE grupo_id = ${id} AND relacao = 'ADICIONAL') AS "totalAreasAdicionais",
        (SELECT COUNT(*)::int FROM producoes_grupo) AS "totalProducoes",
        (SELECT COUNT(*)::int FROM producoes_grupo WHERE doi IS NOT NULL) AS "totalProducoesComDoi",
        (SELECT COUNT(*)::int FROM producoes_grupo WHERE qualis IS NOT NULL) AS "totalProducoesComQualis",
        (SELECT COUNT(*)::int FROM grupo_pesquisa_instituicao WHERE grupo_id = ${id} AND tipo_relacao = 'parceira') AS "totalInstituicoesParceiras",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'total', n) ORDER BY tipo) FROM (
          SELECT COALESCE(p.tipo::text, 'NAO_INFORMADO') tipo, COUNT(*)::int n
          FROM membro_grupo mg JOIN pesquisador p ON p.id = mg.pesquisador_id
          WHERE mg.grupo_id = ${id} GROUP BY p.tipo
        ) q), '[]'::jsonb) AS "pesquisadoresPorTipo",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('formacao', formacao, 'total', n) ORDER BY formacao) FROM (
          SELECT COALESCE(p.formacao_academica::text, 'NAO_INFORMADA') formacao, COUNT(*)::int n
          FROM membro_grupo mg JOIN pesquisador p ON p.id = mg.pesquisador_id
          WHERE mg.grupo_id = ${id} GROUP BY p.formacao_academica
        ) q), '[]'::jsonb) AS "pesquisadoresPorFormacao",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('ano', ano, 'total', n) ORDER BY ano) FROM (
          SELECT ano, COUNT(*)::int n FROM producoes_grupo WHERE ano IS NOT NULL GROUP BY ano
        ) q), '[]'::jsonb) AS "producoesPorAno",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'total', n) ORDER BY tipo) FROM (
          SELECT UPPER(REPLACE(tipo::text, '_', '')) tipo, COUNT(*)::int n FROM producoes_grupo GROUP BY tipo
        ) q), '[]'::jsonb) AS "producoesPorTipo",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('qualis', qualis, 'total', n) ORDER BY qualis) FROM (
          SELECT qualis::text qualis, COUNT(*)::int n FROM producoes_grupo
          WHERE qualis IS NOT NULL GROUP BY qualis
        ) q), '[]'::jsonb) AS "producoesPorQualis"
    `;
    return {
      grupo: toGrupoPesquisaResponse(grupo),
      totais: {
        pesquisadores: m.totalPesquisadores, pesquisadoresComLattes: m.totalPesquisadoresComLattes,
        linhasPesquisa: m.totalLinhasPesquisa, areasConhecimento: m.totalAreasConhecimento,
        areasConhecimentoPrincipais: m.totalAreasPrincipais, areasConhecimentoAdicionais: m.totalAreasAdicionais,
        producoes: m.totalProducoes, instituicoesParceiras: m.totalInstituicoesParceiras,
      },
      cobertura: {
        pesquisadoresComLattesPercentual: percent(m.totalPesquisadoresComLattes, m.totalPesquisadores),
        producoesComDoi: m.totalProducoesComDoi,
        producoesComDoiPercentual: percent(m.totalProducoesComDoi, m.totalProducoes),
        producoesComQualis: m.totalProducoesComQualis,
        producoesComQualisPercentual: percent(m.totalProducoesComQualis, m.totalProducoes),
      },
      pesquisadoresPorTipo: array(m.pesquisadoresPorTipo),
      pesquisadoresPorFormacao: array(m.pesquisadoresPorFormacao),
      producoesPorAno: array(m.producoesPorAno),
      producoesPorTipo: array(m.producoesPorTipo),
      producoesPorQualis: array(m.producoesPorQualis),
    };
  }

  async findMetricasPesquisadores() {
    const [r] = await this.prisma.$queryRaw<Array<{
      total: number; totalComOrcid: number;
      porFormacao: JsonRows<{ formacao: string; total: number }>;
      porTipo: JsonRows<{ tipo: string; total: number }>;
    }>>`
      SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE orcid_id IS NOT NULL)::int "totalComOrcid",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('formacao', formacao, 'total', n) ORDER BY formacao)
          FROM (SELECT COALESCE(formacao_academica::text, 'NAO_INFORMADA') formacao, COUNT(*)::int n
            FROM pesquisador GROUP BY formacao_academica) q), '[]'::jsonb) "porFormacao",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'total', n) ORDER BY tipo)
          FROM (SELECT COALESCE(tipo::text, 'NAO_INFORMADO') tipo, COUNT(*)::int n
            FROM pesquisador GROUP BY tipo) q), '[]'::jsonb) "porTipo"
      FROM pesquisador
    `;
    return {
      totalPesquisadores: r.total, totalComOrcid: r.totalComOrcid,
      porFormacao: array(r.porFormacao), porTipo: array(r.porTipo),
    };
  }

  async findMetricasPesquisador(id: string) {
    const pesquisador = await this.prisma.pesquisador.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, lattesId: true, nome: true, tipo: true, formacaoAcademica: true,
        orcidId: true, openAlexId: true, imageUrl: true, indexH: true, indexI10: true,
      },
    });
    const [m] = await this.prisma.$queryRaw<ResearcherMetrics[]>`
      WITH producoes_pesquisador AS (
        SELECT DISTINCT p.id, p.tipo, p.ano, p.qualis, p.doi
        FROM producao p JOIN producao_pesquisador pp ON pp.producao_id = p.id
        WHERE pp.pesquisador_id = ${id}
      )
      SELECT
        (SELECT COUNT(*)::int FROM membro_grupo WHERE pesquisador_id = ${id}) "totalGrupos",
        (SELECT COUNT(*)::int FROM membro_grupo WHERE pesquisador_id = ${id} AND e_lider) "totalGruposComoLider",
        (SELECT COUNT(*)::int FROM membro_linha_pesquisa WHERE pesquisador_id = ${id}) "totalLinhasPesquisa",
        (SELECT COUNT(*)::int FROM pesquisador_area_conhecimento WHERE pesquisador_id = ${id}) "totalAreasConhecimento",
        (SELECT COUNT(*)::int FROM producao_pesquisador WHERE pesquisador_id = ${id}) "totalProducoes",
        (SELECT COUNT(*)::int FROM producoes_pesquisador WHERE doi IS NOT NULL) "totalProducoesComDoi",
        (SELECT COUNT(*)::int FROM producoes_pesquisador WHERE qualis IS NOT NULL) "totalProducoesComQualis",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'total', n) ORDER BY tipo) FROM (
          SELECT UPPER(REPLACE(tipo::text, '_', '')) tipo, COUNT(*)::int n
          FROM producoes_pesquisador GROUP BY tipo
        ) q), '[]'::jsonb) "producoesPorTipo",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('ano', ano, 'total', n) ORDER BY ano) FROM (
          SELECT ano, COUNT(*)::int n FROM producoes_pesquisador WHERE ano IS NOT NULL GROUP BY ano
        ) q), '[]'::jsonb) "producoesPorAno",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('qualis', qualis, 'total', n) ORDER BY qualis) FROM (
          SELECT qualis::text qualis, COUNT(*)::int n FROM producoes_pesquisador
          WHERE qualis IS NOT NULL GROUP BY qualis
        ) q), '[]'::jsonb) "producoesPorQualis"
    `;
    return {
      pesquisador,
      totais: {
        grupos: m.totalGrupos, gruposComoLider: m.totalGruposComoLider,
        linhasPesquisa: m.totalLinhasPesquisa, areasConhecimento: m.totalAreasConhecimento,
        producoes: m.totalProducoes,
      },
      cobertura: {
        producoesComDoi: m.totalProducoesComDoi,
        producoesComDoiPercentual: percent(m.totalProducoesComDoi, m.totalProducoes),
        producoesComQualis: m.totalProducoesComQualis,
        producoesComQualisPercentual: percent(m.totalProducoesComQualis, m.totalProducoes),
      },
      producoesPorTipo: array(m.producoesPorTipo),
      producoesPorAno: array(m.producoesPorAno),
      producoesPorQualis: array(m.producoesPorQualis),
    };
  }

  async findMetricasAreasConhecimento() {
    const [r] = await this.prisma.$queryRaw<Array<{
      total: number; raizes: number; comAreaPai: number; gruposComAreaPrincipal: number;
      mapeadasOpenAlex: number;
      cnpqPorTipo: JsonRows<{ tipo: string; total: number }>;
      openAlexPorTipo: JsonRows<{ tipo: string; total: number }>;
      gruposAreasPorRelacao: JsonRows<{ relacao: string; total: number }>;
      gruposAreasPorMetodo: JsonRows<{ metodoInferencia: string; total: number }>;
      mapeamentosPorStatus: JsonRows<{ status: string; total: number }>;
    }>>`
      SELECT
        (SELECT COUNT(*)::int FROM area_conhecimento) total,
        (SELECT COUNT(*)::int FROM area_conhecimento WHERE area_pai_id IS NULL) raizes,
        (SELECT COUNT(*)::int FROM area_conhecimento WHERE area_pai_id IS NOT NULL) "comAreaPai",
        (SELECT COUNT(DISTINCT area_conhecimento_id)::int FROM mapeamento_area_taxonomia) "mapeadasOpenAlex",
        (SELECT COUNT(*)::int FROM grupo_pesquisa WHERE area_conhecimento_id IS NOT NULL) "gruposComAreaPrincipal",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'total', n) ORDER BY tipo) FROM (
          SELECT COALESCE(tipo::text, 'NAO_INFORMADO') tipo, COUNT(*)::int n
          FROM area_conhecimento GROUP BY tipo) q), '[]'::jsonb) "cnpqPorTipo",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'total', n) ORDER BY tipo) FROM (
          SELECT tipo::text tipo, COUNT(*)::int n FROM open_alex_area_conhecimento GROUP BY tipo
        ) q), '[]'::jsonb) "openAlexPorTipo",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('relacao', relacao, 'total', n) ORDER BY relacao) FROM (
          SELECT relacao::text relacao, COUNT(*)::int n FROM grupo_pesquisa_area_conhecimento GROUP BY relacao
        ) q), '[]'::jsonb) "gruposAreasPorRelacao",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('metodoInferencia', metodo, 'total', n) ORDER BY metodo) FROM (
          SELECT metodo_inferencia::text metodo, COUNT(*)::int n
          FROM grupo_pesquisa_area_conhecimento GROUP BY metodo_inferencia
        ) q), '[]'::jsonb) "gruposAreasPorMetodo",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'total', n) ORDER BY status) FROM (
          SELECT status::text status, COUNT(*)::int n FROM mapeamento_area_taxonomia GROUP BY status
        ) q), '[]'::jsonb) "mapeamentosPorStatus"
    `;
    return {
      total: r.total, raizes: r.raizes, comAreaPai: r.comAreaPai,
      gruposComAreaPrincipal: r.gruposComAreaPrincipal, mapeadasOpenAlex: r.mapeadasOpenAlex,
      mapeadasOpenAlexPercentual: percent(r.mapeadasOpenAlex, r.total),
      cnpqPorTipo: array(r.cnpqPorTipo), openAlexPorTipo: array(r.openAlexPorTipo),
      gruposAreasPorRelacao: array(r.gruposAreasPorRelacao),
      gruposAreasPorMetodo: array(r.gruposAreasPorMetodo),
      mapeamentosPorStatus: array(r.mapeamentosPorStatus),
    };
  }

  async findMetricasProducoes() {
    const [r] = await this.prisma.$queryRaw<Array<{
      total: number; doiNulos: number; qualisNulos: number; issnNulos: number;
      resumoNulos: number; urlNulos: number;
      totalPorQualis: JsonRows<{ qualis: string; total: number }>;
      totalPorTipo: JsonRows<{ tipo: string; total: number }>;
      totalPorAno: JsonRows<{ ano: number; total: number }>;
    }>>`
      SELECT COUNT(*)::int total,
        COUNT(*) FILTER (WHERE doi IS NULL)::int "doiNulos",
        COUNT(*) FILTER (WHERE qualis IS NULL)::int "qualisNulos",
        COUNT(*) FILTER (WHERE issn IS NULL)::int "issnNulos",
        COUNT(*) FILTER (WHERE resumo IS NULL)::int "resumoNulos",
        COUNT(*) FILTER (WHERE url IS NULL)::int "urlNulos",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('qualis', qualis, 'total', n) ORDER BY qualis) FROM (
          SELECT qualis::text qualis, COUNT(*)::int n FROM producao WHERE qualis IS NOT NULL GROUP BY qualis
        ) q), '[]'::jsonb) "totalPorQualis",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'total', n) ORDER BY tipo) FROM (
          SELECT UPPER(REPLACE(tipo::text, '_', '')) tipo, COUNT(*)::int n FROM producao GROUP BY tipo
        ) q), '[]'::jsonb) "totalPorTipo",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('ano', ano, 'total', n) ORDER BY ano) FROM (
          SELECT ano, COUNT(*)::int n FROM producao WHERE ano IS NOT NULL GROUP BY ano
        ) q), '[]'::jsonb) "totalPorAno"
      FROM producao
    `;
    return {
      total: r.total,
      valoresNulos: { doi: r.doiNulos, resumo: r.resumoNulos, issn: r.issnNulos, qualis: r.qualisNulos, url: r.urlNulos },
      cobertura: {
        doiPercentual: percent(r.total - r.doiNulos, r.total),
        resumoPercentual: percent(r.total - r.resumoNulos, r.total),
        issnPercentual: percent(r.total - r.issnNulos, r.total),
        qualisPercentual: percent(r.total - r.qualisNulos, r.total),
        urlPercentual: percent(r.total - r.urlNulos, r.total),
      },
      totalPorQualis: array(r.totalPorQualis), totalPorTipo: array(r.totalPorTipo), totalPorAno: array(r.totalPorAno),
    };
  }

  async findMetricasInstituicoes() {
    const [r] = await this.prisma.$queryRaw<Array<{
      total: number; totalSemUf: number;
      porUf: JsonRows<{ uf: string; estado: string | null; regiao: string | null; total: number }>;
      vinculosSede: number; vinculosParceria: number;
      instituicoesComSede: number; instituicoesComParceria: number;
    }>>`
      SELECT
        (SELECT COUNT(*)::int FROM instituicao) total,
        (SELECT COUNT(*)::int FROM instituicao WHERE estado_id IS NULL) "totalSemUf",
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'uf', e.sigla, 'estado', e.nome, 'regiao', e.regiao, 'total', q.n
        ) ORDER BY q.estado_id) FROM (
          SELECT estado_id, COUNT(*)::int n FROM instituicao
          WHERE estado_id IS NOT NULL GROUP BY estado_id
        ) q JOIN estado e ON e.id = q.estado_id), '[]'::jsonb) "porUf",
        (SELECT COUNT(*)::int FROM grupo_pesquisa_instituicao WHERE tipo_relacao = 'sede') "vinculosSede",
        (SELECT COUNT(*)::int FROM grupo_pesquisa_instituicao WHERE tipo_relacao = 'parceira') "vinculosParceria",
        (SELECT COUNT(DISTINCT instituicao.id)::int FROM instituicao
          JOIN grupo_pesquisa_instituicao ON instituicao_id = instituicao.id
          WHERE tipo_relacao = 'sede') "instituicoesComSede",
        (SELECT COUNT(DISTINCT instituicao.id)::int FROM instituicao
          JOIN grupo_pesquisa_instituicao ON instituicao_id = instituicao.id
          WHERE tipo_relacao = 'parceira') "instituicoesComParceria"
    `;
    return {
      total: r.total, semUf: r.totalSemUf, porUf: array(r.porUf),
      vinculosComGrupos: { sede: r.vinculosSede, parceira: r.vinculosParceria },
      instituicoesComGrupos: { sede: r.instituicoesComSede, parceira: r.instituicoesComParceria },
    };
  }

  async findMetricasFilasExtracao() {
    const [r] = await this.prisma.$queryRaw<Array<{
      gruposPorStatus: Array<{ status: string; total: number }>;
      pesquisadoresPorStatus: Array<{ status: string; total: number }>;
      gruposComErro: number; pesquisadoresComErro: number;
    }>>`
      SELECT
        COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'total', n) ORDER BY ordem) FROM (
          SELECT status::text status, COUNT(*)::int n,
            CASE status::text WHEN 'PENDENTE' THEN 1 WHEN 'PROCESSANDO' THEN 2
              WHEN 'CONCLUIDO' THEN 3 WHEN 'ERRO' THEN 4 ELSE 5 END ordem
          FROM fila_extracao_grupo GROUP BY status
        ) q), '[]'::jsonb) "gruposPorStatus",
        COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'total', n) ORDER BY ordem) FROM (
          SELECT status::text status, COUNT(*)::int n,
            CASE status::text WHEN 'PENDENTE' THEN 1 WHEN 'PROCESSANDO' THEN 2
              WHEN 'CONCLUIDO' THEN 3 WHEN 'ERRO' THEN 4 ELSE 5 END ordem
          FROM fila_extracao_pesquisador GROUP BY status
        ) q), '[]'::jsonb) "pesquisadoresPorStatus",
        (SELECT COUNT(*)::int FROM fila_extracao_grupo WHERE status = 'ERRO') "gruposComErro",
        (SELECT COUNT(*)::int FROM fila_extracao_pesquisador WHERE status = 'ERRO') "pesquisadoresComErro"
    `;
    return {
      gruposPesquisa: { comErro: r.gruposComErro, porStatus: array(r.gruposPorStatus) },
      pesquisadores: { comErro: r.pesquisadoresComErro, porStatus: array(r.pesquisadoresPorStatus) },
    };
  }
}
