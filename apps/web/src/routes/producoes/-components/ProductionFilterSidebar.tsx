import type { ProductionSortField, ProductionTypeFilter } from '#/api/producoes'
import type { SortOrder } from '#/api/sorting'
import { Button } from '#/components/ui/button'
import { DebouncedInput } from '#/components/ui/debounced-input'
import { FilterModal } from '#/components/ui/filter-modal'
import { Input } from '#/components/ui/input'
import { SortControls } from '#/components/ui/sort-controls'
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useState, type FC } from 'react'

interface ProductionsFilterSidebarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedType: ProductionTypeFilter | ''
  onSelectedTypeChange: (type: ProductionTypeFilter | '') => void
  selectedQualis: string[]
  onToggleQualis: (qualis: string) => void
  yearFrom: string
  onYearFromChange: (value: string) => void
  yearTo: string
  onYearToChange: (value: string) => void
  selectedInstitution: string
  onInstitutionChange: (institution: string) => void
  onResetFilters: () => void
  onApplyFilters?: () => void
  sortField: ProductionSortField
  onSortFieldChange: (field: ProductionSortField) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
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
const SORT_FIELDS = [
  { value: 'titulo', label: 'Título' },
  { value: 'ano', label: 'Ano' },
  { value: 'tipo', label: 'Tipo' },
  { value: 'qualis', label: 'Qualis' },
] satisfies { value: ProductionSortField; label: string }[]

export const ProductionsFilterSidebar: FC<ProductionsFilterSidebarProps> = (
  props,
) => {
  const [isOpen, setIsOpen] = useState(false)
  const hasActiveFilters =
    Boolean(props.searchQuery) ||
    props.selectedQualis.length > 0 ||
    Boolean(props.yearFrom) ||
    Boolean(props.yearTo) ||
    props.selectedInstitution !== 'Todas as instituições' ||
    Boolean(props.selectedType) ||
    props.sortField !== 'ano' ||
    props.sortOrder !== 'desc'

  return (
    <aside className="space-y-4 md:col-span-3">
      <div className="sticky top-24 rounded-lg border border-border-subtle bg-background p-4 shadow-xs md:p-5">
        <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <SlidersHorizontal className="h-4 w-4 text-secondary" />
            <span>Filtros</span>
          </h2>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={props.onResetFilters}
              className="h-auto px-0 text-[11px] text-secondary hover:bg-transparent hover:text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Limpar</span>
            </Button>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Título da produção
            </label>
            <div className="relative">
              <DebouncedInput
                type="text"
                variant="filled"
                size="sm"
                leftIcon={<Search />}
                placeholder="Buscar por título"
                value={props.searchQuery}
                onValueChange={props.onSearchChange}
                className="pr-8 placeholder:text-secondary"
              />
              {props.searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => props.onSearchChange('')}
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-secondary hover:bg-transparent hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Ano de publicação
            </label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                variant="filled"
                size="sm"
                placeholder="De"
                value={props.yearFrom}
                onChange={(event) => props.onYearFromChange(event.target.value)}
                min="1900"
                max="2026"
              />
              <span className="text-xs font-semibold text-muted-foreground">
                -
              </span>
              <Input
                type="number"
                variant="filled"
                size="sm"
                placeholder="Até"
                value={props.yearTo}
                onChange={(event) => props.onYearToChange(event.target.value)}
                min="1900"
                max="2026"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => setIsOpen(true)}
          >
            <SlidersHorizontal className="size-4" />
            Mais filtros
          </Button>
        </div>
      </div>

      <FilterModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onApply={() => props.onApplyFilters?.()}
        onReset={props.onResetFilters}
      >
        <label className="text-xs font-semibold text-primary">
          Tipo de produção
          <select
            value={props.selectedType}
            onChange={(event) =>
              props.onSelectedTypeChange(
                event.target.value as ProductionTypeFilter | '',
              )
            }
            className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm"
          >
            {PRODUCTION_TYPES.map((type) => (
              <option key={type.value || 'all'} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-primary">
          Instituição
          <select
            value={props.selectedInstitution}
            onChange={(event) => props.onInstitutionChange(event.target.value)}
            className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm"
          >
            {INSTITUTION_OPTIONS.map((institution) => (
              <option key={institution}>{institution}</option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <span className="mb-2 block text-xs font-semibold text-primary">
            Qualis CAPES
          </span>
          <div className="flex flex-wrap gap-1.5">
            {QUALIS_LEVELS.map((qualis) => {
              const isActive = props.selectedQualis.includes(qualis)

              return (
                <Button
                  key={qualis}
                  type="button"
                  variant={isActive ? 'primary' : 'outline'}
                  size="xs"
                  onClick={() => props.onToggleQualis(qualis)}
                >
                  {qualis}
                </Button>
              )
            })}
          </div>
        </div>

        <SortControls
          field={props.sortField}
          fields={SORT_FIELDS}
          order={props.sortOrder}
          onFieldChange={props.onSortFieldChange}
          onOrderChange={props.onSortOrderChange}
        />
      </FilterModal>
    </aside>
  )
}
