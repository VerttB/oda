export const SIMCC_INSTITUTIONS = [
  { sigla: 'UFBA', nome: 'Universidade Federal da Bahia' },
  { sigla: 'EBMSP', nome: 'Escola Bahiana de Medicina e Saude Publica' },
  { sigla: 'UESB', nome: 'Universidade Estadual do Sudoeste da Bahia' },
  { sigla: 'UFOB', nome: 'Universidade Federal do Oeste da Bahia' },
  { sigla: 'UFSB', nome: 'Universidade Federal do Sul da Bahia' },
  { sigla: 'UEFS', nome: 'Universidade Estadual de Feira de Santana' },
  { sigla: 'UESC', nome: 'Universidade Estadual de Santa Cruz' },
  { sigla: 'UFRB', nome: 'Universidade Federal do Reconcavo da Bahia' },
  { sigla: 'UNEB', nome: 'Universidade do Estado da Bahia' },
  { sigla: 'IFBA', nome: 'Instituto Federal da Bahia' },
  { sigla: 'FIOCRUZ', nome: 'Fundacao Oswaldo Cruz', aliases: ['Instituto Goncalo Moniz'] },
] as const;

export function normalizeSimccInstitution(value: string | null | undefined) {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isSimccInstitution(value: string | null | undefined) {
  const normalized = normalizeSimccInstitution(value);
  if (!normalized) return false;
  const words = new Set(normalized.split(' '));

  return SIMCC_INSTITUTIONS.some(institution => {
    if (words.has(institution.sigla.toLocaleLowerCase('pt-BR'))) return true;
    if (normalized.includes(normalizeSimccInstitution(institution.nome))) return true;
    return 'aliases' in institution
      && institution.aliases.some(alias => normalized.includes(normalizeSimccInstitution(alias)));
  });
}
