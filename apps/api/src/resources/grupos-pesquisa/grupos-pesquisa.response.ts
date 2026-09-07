import type { Prisma, GrupoPesquisa } from '@oda/database';
import { GruposPesquisaResponseSchema } from '@oda/shared-types';

type GrupoRelacoes = Prisma.GrupoPesquisaGetPayload<{ include: {
  instituicoes: { include: { instituicao: { include: { estado: true } } } };
  areasConhecimento: { include: { area: true } };
  linhasPesquisa: true;
  membros: { include: { pesquisador: true } };
} }>;
type GrupoInput = Omit<GrupoPesquisa, 'criadoEm' | 'atualizadoEm'>
  & Partial<Pick<GrupoRelacoes, 'instituicoes' | 'areasConhecimento' | 'linhasPesquisa' | 'membros'>>;

export function toGrupoPesquisaResponse(grupo: GrupoInput) {
  return GruposPesquisaResponseSchema.parse({
    ...grupo,
    instituicoes: grupo.instituicoes?.map(vinculo => ({
      ...vinculo.instituicao,
      tipoRelacao: vinculo.tipoRelacao,
      unidade: vinculo.unidade !== null || vinculo.unidadeUf !== null
        ? { nome: vinculo.unidade, uf: vinculo.unidadeUf } : null,
    })),
    areasConhecimento: grupo.areasConhecimento?.map(vinculo => vinculo.area),
    membros: grupo.membros?.map(vinculo => ({
      ...vinculo.pesquisador,
      eLider: vinculo.eLider,
      dataEntrada: vinculo.dataEntrada?.toISOString() ?? null,
    })),
  });
}
