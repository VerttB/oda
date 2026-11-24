/** Identidade conservadora v1: mantém símbolos, qualificadores e acentos. */
export function keywordIdentity(term: string): string {
  return term.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('pt-BR');
}

export function keywordSearchKey(term: string): string {
  return keywordIdentity(term).normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}
