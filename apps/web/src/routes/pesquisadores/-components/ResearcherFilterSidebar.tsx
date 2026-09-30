import type {
  ResearcherDegreeFilter,
  ResearchersMetrics,
  ResearcherSortField,
  ResearcherTypeFilter,
} from '#/api/pesquisadores'
import type { SortOrder } from '#/api/sorting'
import { Button } from '#/components/ui/button'
import { DebouncedInput } from '#/components/ui/debounced-input'
import { FilterModal } from '#/components/ui/filter-modal'
import { SortControls } from '#/components/ui/sort-controls'
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useState, type FC } from 'react'

interface Props {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedDegree: ResearcherDegreeFilter | ''
  onSelectedDegreeChange: (value: ResearcherDegreeFilter | '') => void
  selectedType: ResearcherTypeFilter | ''
  onSelectedTypeChange: (value: ResearcherTypeFilter | '') => void
  sortField: ResearcherSortField
  onSortFieldChange: (field: ResearcherSortField) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
  onClearFilters: () => void
  metrics?: ResearchersMetrics
}

const SORT_FIELDS = [
  { value: 'nome', label: 'Nome' },
  { value: 'tipo', label: 'Tipo' },
  { value: 'formacaoAcademica', label: 'Formação acadêmica' },
  { value: 'indexH', label: 'Índice H' },
] satisfies { value: ResearcherSortField; label: string }[]

export const ResearchersFilterSidebar: FC<Props> = (props) => {
  const [isOpen, setIsOpen] = useState(false)
  const active = Boolean(
    props.searchQuery ||
    props.selectedDegree ||
    props.selectedType ||
    props.sortField !== 'nome' ||
    props.sortOrder !== 'asc',
  )

  return (
    <aside className="w-full shrink-0 md:w-72">
      <div className="sticky top-24 space-y-5">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <SlidersHorizontal className="size-4 text-secondary" />
            Filtros
          </h2>
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={props.onClearFilters}
              className="h-auto px-0 text-secondary"
            >
              <RotateCcw className="size-3" />
              Limpar
            </Button>
          ) : null}
        </div>

        <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          Nome do pesquisador
          <div className="relative mt-1.5">
            <DebouncedInput
              type="text"
              variant="filled"
              size="sm"
              leftIcon={<Search />}
              placeholder="Buscar por nome"
              value={props.searchQuery}
              onValueChange={props.onSearchChange}
              className="pr-8"
            />
            {props.searchQuery ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => props.onSearchChange('')}
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </label>

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

      <FilterModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onApply={() => undefined}
        onReset={props.onClearFilters}
      >
        <label className="text-xs font-semibold text-primary">
          Instituição
          <input
            placeholder="Nome ou sigla"
            className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary">
          Grupo de pesquisa
          <input
            placeholder="Nome do grupo"
            className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary">
          ID Lattes
          <input
            placeholder="16 dígitos"
            className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary">
          ORCID
          <input
            placeholder="0000-0000-0000-0000"
            className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-semibold text-primary">
          Formação
          <select
            value={props.selectedDegree}
            onChange={(event) =>
              props.onSelectedDegreeChange(
                event.target.value as ResearcherDegreeFilter | '',
              )
            }
            className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {[
              'GRADUACAO',
              'ESPECIALIZACAO',
              'MESTRADO',
              'DOUTORADO',
              'OUTRO',
            ].map((degree) => (
              <option key={degree} value={degree}>
                {degree}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-primary">
          Tipo
          <select
            value={props.selectedType}
            onChange={(event) =>
              props.onSelectedTypeChange(
                event.target.value as ResearcherTypeFilter | '',
              )
            }
            className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {[
              'PESQUISADOR',
              'ESTUDANTE',
              'TECNICO',
              'COLABORADOR_ESTRANGEIRO',
            ].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-primary">
          <input type="checkbox" />É líder
        </label>
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
