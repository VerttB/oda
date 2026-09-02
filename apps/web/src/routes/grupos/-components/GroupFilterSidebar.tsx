import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import type { FC } from 'react'

interface GroupFilterSidebar {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedUf: string
  onUfChange: (uf: string) => void
  selectedArea: string
  onAreaChange: (area: string) => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  onClearFilters: () => void
  onApplyFilters?: () => void
}

const KNOWLEDGE_AREAS = [
  'Todas as Áreas',
  'Engenharia',
  'Ciências Biológicas',
  'Ciências da Computação',
  'Física',
  'Sociologia',
  'Ciências da Saúde',
]

const UF_OPTIONS = [
  { value: '', label: 'Todos os estados' },
  { value: 'SP', label: 'São Paulo (SP)' },
  { value: 'RJ', label: 'Rio de Janeiro (RJ)' },
  { value: 'MG', label: 'Minas Gerais (MG)' },
  { value: 'RS', label: 'Rio Grande do Sul (RS)' },
  { value: 'BA', label: 'Bahia (BA)' },
  { value: 'PE', label: 'Pernambuco (PE)' },
]

export const DirectoryFilterSidebar: FC<GroupFilterSidebar> = ({
  searchQuery,
  onSearchChange,
  selectedUf,
  onUfChange,
  selectedArea,
  onAreaChange,
  selectedStatus,
  onStatusChange,
  onClearFilters,
  onApplyFilters,
}) => {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(selectedUf) ||
    Boolean(selectedArea) ||
    selectedStatus !== 'Todos'

  return (
    <aside className="w-full shrink-0 border-border-subtle lg:w-64 lg:border-r lg:pr-6">
      <div className="sticky top-24 space-y-6">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <SlidersHorizontal className="h-4 w-4 text-secondary" />
            <span>Filtros</span>
          </h3>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-secondary transition-colors hover:text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {/* Filtro por nome do grupo */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Nome do grupo
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
              <input
                type="text"
                placeholder="Ex.: ciência de dados"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-background py-2 pl-8 pr-7 text-xs text-foreground placeholder:text-secondary focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-secondary hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Estado / UF
            </label>
            <select
              value={selectedUf}
              onChange={(e) => onUfChange(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {UF_OPTIONS.map((uf) => (
                <option key={uf.value} value={uf.value}>
                  {uf.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Área de Conhecimento
            </label>
            <select
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {KNOWLEDGE_AREAS.map((area) => (
                <option
                  key={area}
                  value={area === 'Todas as Áreas' ? '' : area}
                >
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-secondary">
              Status do Grupo
            </label>
            <div className="flex gap-2">
              {['Todos', 'Ativo', 'Arquivado'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStatusChange(st)}
                  className={`flex-1 py-1.5 text-[11px] rounded font-medium border transition-colors cursor-pointer ${
                    selectedStatus === st
                      ? 'bg-secondary text-white border-secondary font-semibold'
                      : 'border-border-subtle bg-background text-secondary hover:bg-surface'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onApplyFilters}
            className="w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover"
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </aside>
  )
}
