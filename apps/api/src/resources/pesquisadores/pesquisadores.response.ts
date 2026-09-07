import type { Prisma, Pesquisador } from '@oda/database';
import { PesquisadorResponseSchema } from '@oda/shared-types';

type PesquisadorRelacoes = Prisma.PesquisadorGetPayload<{ include: {
  producoes: { include: { producao: true } };
  membrosGrupo: { include: { grupoPesquisa: true } };
  areasConhecimento: { include: { area: true } };
} }>;
type PesquisadorInput = Omit<Pesquisador, 'criadoEm' | 'atualizadoEm'>
  & Partial<Pick<PesquisadorRelacoes, 'producoes' | 'membrosGrupo' | 'areasConhecimento'>>;

export function toPesquisadorResponse(pesquisador: PesquisadorInput) {
  return PesquisadorResponseSchema.parse({
    ...pesquisador,
    producoes: pesquisador.producoes?.map(vinculo => ({
      ...vinculo.producao,
      ordemAutoria: vinculo.ordemAutoria,
    })),
    membrosGrupo: pesquisador.membrosGrupo?.map(vinculo => ({
      ...vinculo.grupoPesquisa,
      eLider: vinculo.eLider,
      dataEntrada: vinculo.dataEntrada?.toISOString() ?? null,
    })),
    areasConhecimento: pesquisador.areasConhecimento?.map(vinculo => vinculo.area),
  });
}
