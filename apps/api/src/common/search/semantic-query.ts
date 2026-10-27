import { BadRequestException } from '@nestjs/common';

type SearchQuery = {
  q?: string;
  modoBusca?: 'textual' | 'semantica';
  size?: number;
  ordenarPor?: string;
  ordem?: string;
};

export function validateSearchQuery(query?: SearchQuery) {
  if (!query) return;
  if ((query.q && !query.modoBusca) || (query.modoBusca && !query.q)) {
    throw new BadRequestException('Os parametros q e modoBusca devem ser informados juntos.');
  }
  if (query.modoBusca === 'semantica') {
    const size = query.size ?? 30;
    if (size < 1 || size > 100) {
      throw new BadRequestException('A busca semantica aceita size entre 1 e 100.');
    }
    if (query.ordenarPor || query.ordem) {
      throw new BadRequestException('A busca semantica ja ordena os resultados por relevancia.');
    }
  }
}

export function withoutSearchControls(query: Record<string, unknown>) {
  const { q: _q, modoBusca: _modoBusca, page: _page, size: _size, ordenarPor: _ordenarPor, ordem: _ordem, ...filters } = query;
  return filters;
}
