import { SIMCC_CIMATEC, SIMCC_INSTITUTIONS } from '@oda/shared-types';
import type { Prisma, PrismaClient } from '../generated/prisma';

const cimatecNames = [SIMCC_CIMATEC.nome, ...SIMCC_CIMATEC.aliases];

export const SIMCC_INSTITUICOES_WHERE: Prisma.InstituicaoWhereInput = {
  OR: [
    { sigla: { in: SIMCC_INSTITUTIONS.filter(item => item.sigla !== 'FIOCRUZ' && item.sigla !== SIMCC_CIMATEC.sigla).map(item => item.sigla) } },
    { sigla: { startsWith: 'IFBA -', mode: 'insensitive' } },
    { sigla: 'FIOCRUZ', nome: { contains: 'Moniz', mode: 'insensitive' } },
    { sigla: { equals: SIMCC_CIMATEC.sigla, mode: 'insensitive' } },
    ...cimatecNames.map(nome => ({ nome: { contains: nome, mode: 'insensitive' as const } })),
  ],
};

const CIMATEC_SEDE_REGIONAL_WHERE = {
  instituicao: { OR: [
    { sigla: { equals: SIMCC_CIMATEC.mantenedoraSigla, mode: 'insensitive' } },
    { nome: { startsWith: SIMCC_CIMATEC.mantenedoraNome, mode: 'insensitive' } },
  ] },
  OR: [SIMCC_CIMATEC.sigla, ...SIMCC_CIMATEC.aliases]
    .map(unidade => ({ unidade: { contains: unidade, mode: 'insensitive' as const } })),
} satisfies Prisma.GrupoPesquisaInstituicaoWhereInput;

export const SIMCC_SEDE_WHERE = {
  tipoRelacao: 'SEDE',
  OR: [{ instituicao: SIMCC_INSTITUICOES_WHERE }, CIMATEC_SEDE_REGIONAL_WHERE],
} satisfies Prisma.GrupoPesquisaInstituicaoWhereInput;

/** A fila de descoberta do DGP só traz o nome da instituição, sem unidade. */
export async function findRegionalCimatecDgpIds(db: Pick<PrismaClient, 'grupoPesquisa'>) {
  const groups = await db.grupoPesquisa.findMany({
    where: { dgpId: { not: null }, instituicoes: { some: {
      tipoRelacao: 'SEDE', ...CIMATEC_SEDE_REGIONAL_WHERE,
    } } },
    select: { dgpId: true },
  });
  return new Set(groups.map(group => group.dgpId).filter((id): id is string => id !== null));
}
