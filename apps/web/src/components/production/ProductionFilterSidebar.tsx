import type { ProductionTypeFilter } from '#/api/producoes'
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import type { FC } from 'react'

interface ProductionsFilterSidebarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedType: ProductionTypeFilter | ''
  onSelectedTypeChange: (type: ProductionTypeFilter | '') => void
  selectedQualis: string[]
  onToggleQualis: (qualis: string) => void
  yearFrom: string
  onYearFromChange: (val: string) => void
  yearTo: string
  onYearToChange: (val: string) => void
  selectedInstitution: string
  onInstitutionChange: (inst: string) => void
  onResetFilters: () => void
  onApplyFilters?: () => void
}

const PRODUCTION_TYPES: {
  value: ProductionTypeFilter | ''
  label: string
}[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'ARTIGO', label: 'Artigos' },
  { value: 'LIVROCAPITULO', label: 'Capítulos de livro' },
  { value: 'OUTRA', label: 'Outras produções' },
]

const QUALIS_LEVELS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C']

const INSTITUTION_OPTIONS = ['Todas as instituições']

export const ProductionsFilterSidebar: FC<ProductionsFilterSidebarProps> = ({
  searchQuery,
  onSearchChange,
  selectedType,
  onSelectedTypeChange,
  selectedQualis,
  onToggleQualis,
  yearFrom,
  onYearFromChange,
  yearTo,
  onYearToChange,
  selectedInstitution,
  onInstitutionChange,
  onResetFilters,
  onApplyFilters,
}) => {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedQualis.length > 0 ||
    Boolean(yearFrom) ||
    Boolean(yearTo) ||
    selectedInstitution !== 'Todas as instituições' ||
    Boolean(selectedType)

  return (
    <aside className="space-y-4 md:col-span-3">
      <div className="sticky top-24 rounded-lg border border-border-subtle bg-background p-4 shadow-xs md:p-5">
        <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <SlidersHorizontal className="h-4 w-4 text-secondary" />
            <span>Filtros</span>
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-secondary transition-colors hover:text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Título da produção
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por título"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="w-full rounded border border-border-subtle bg-surface py-2 pl-9 pr-8 text-xs text-foreground transition-colors placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-secondary hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Ano de publicação
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                placeholder="De"
                value={yearFrom}
                onChange={(event) => onYearFromChange(event.target.value)}
                min="1900"
                max="2026"
                className="w-full rounded border border-border-subtle bg-surface px-2.5 py-2 text-xs text-foreground placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs font-semibold text-muted-foreground">
                -
              </span>
              <input
                type="number"
                placeholder="Até"
                value={yearTo}
                onChange={(event) => onYearToChange(event.target.value)}
                min="1900"
                max="2026"
                className="w-full rounded border border-border-subtle bg-surface px-2.5 py-2 text-xs text-foreground placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Tipo de produção
            </label>
            <select
              value={selectedType}
              onChange={(event) =>
                onSelectedTypeChange(
                  event.target.value as ProductionTypeFilter | '',
                )
              }
              className="w-full cursor-pointer rounded border border-border-subtle bg-surface px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PRODUCTION_TYPES.map((type) => (
                <option key={type.value || 'all'} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Qualis CAPES
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUALIS_LEVELS.map((qualis) => {
                const isActive = selectedQualis.includes(qualis)

                return (
                  <button
                    key={qualis}
                    type="button"
                    onClick={() => onToggleQualis(qualis)}
                    className={`cursor-pointer rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                      isActive
                        ? 'border-primary bg-primary text-white'
                        : 'border-border-subtle bg-surface text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {qualis}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Instituição
            </label>
            <select
              value={selectedInstitution}
              onChange={(event) => onInstitutionChange(event.target.value)}
              className="w-full cursor-pointer rounded border border-border-subtle bg-surface px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {INSTITUTION_OPTIONS.map((institution) => (
                <option key={institution} value={institution}>
                  {institution}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onApplyFilters}
            className="mt-2 w-full cursor-pointer rounded bg-primary py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover"
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </aside>
  )
}
