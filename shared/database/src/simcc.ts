import { SIMCC_INSTITUTIONS } from '@oda/shared-types';
import type { Prisma } from '../generated/prisma';

export const SIMCC_INSTITUICOES_WHERE: Prisma.InstituicaoWhereInput = {
  OR: [
    { sigla: { in: SIMCC_INSTITUTIONS.filter(item => item.sigla !== 'FIOCRUZ').map(item => item.sigla) } },
    { sigla: { startsWith: 'IFBA -', mode: 'insensitive' } },
    { sigla: 'FIOCRUZ', nome: { contains: 'Moniz', mode: 'insensitive' } },
  ],
};
