import type {
  ResearcherDegreeFilter,
  ResearchersMetrics,
  ResearcherTypeFilter,
} from '#/api/pesquisadores'
import { Button } from '#/components/ui/button'
import { DebouncedInput } from '#/components/ui/debounced-input'
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import type { FC } from 'react'

interface ResearchersFilterSidebarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedDegree: ResearcherDegreeFilter | ''
  onSelectedDegreeChange: (degree: ResearcherDegreeFilter | '') => void
  selectedType: ResearcherTypeFilter | ''
  onSelectedTypeChange: (type: ResearcherTypeFilter | '') => void
  onClearFilters: () => void
  metrics?: ResearchersMetrics
}

const DEGREE_OPTIONS: {
  value: ResearcherDegreeFilter | ''
  label: string
}[] = [
  { value: '', label: 'Todas as formações' },
  { value: 'GRADUACAO', label: 'Graduação' },
  { value: 'ESPECIALIZACAO', label: 'Especialização' },
  { value: 'MESTRADO', label: 'Mestrado' },
  { value: 'DOUTORADO', label: 'Doutorado' },
  { value: 'OUTRO', label: 'Outro' },
]

const TYPE_OPTIONS: {
  value: ResearcherTypeFilter | ''
  label: string
}[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'PESQUISADOR', label: 'Pesquisador' },
  { value: 'ESTUDANTE', label: 'Estudante' },
  { value: 'TECNICO', label: 'Técnico' },
  { value: 'COLABORADOR_ESTRANGEIRO', label: 'Colaborador estrangeiro' },
]

export const ResearchersFilterSidebar: FC<ResearchersFilterSidebarProps> = ({
  searchQuery,
  onSearchChange,
  selectedDegree,
  onSelectedDegreeChange,
  selectedType,
  onSelectedTypeChange,
  onClearFilters,
  metrics,
}) => {
  const hasActiveFilters =
    Boolean(searchQuery) || Boolean(selectedDegree) || Boolean(selectedType)

  const getDegreeCount = (degree: string) =>
    metrics?.byDegree.find((item) => item.degree === degree)?.count

  const getTypeCount = (type: string) =>
    metrics?.byType.find((item) => item.type === type)?.count

  return (
    <aside className="w-full shrink-0 md:w-72">
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
              onClick={onClearFilters}
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
              Nome do pesquisador
            </label>
            <div className="relative">
              <DebouncedInput
                type="text"
                variant="filled"
                size="sm"
                leftIcon={<Search />}
                placeholder="Buscar por nome"
                value={searchQuery}
                onValueChange={onSearchChange}
                className="pr-8 placeholder:text-secondary"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onSearchChange('')}
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-secondary hover:bg-transparent hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Formação acadêmica
            </label>
            <select
              value={selectedDegree}
              onChange={(event) =>
                onSelectedDegreeChange(
                  event.target.value as ResearcherDegreeFilter | '',
                )
              }
              className="w-full cursor-pointer rounded border border-border-subtle bg-surface px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DEGREE_OPTIONS.map((degree) => {
                const count = degree.value ? getDegreeCount(degree.value) : null

                return (
                  <option key={degree.value || 'all'} value={degree.value}>
                    {degree.label}
                    {typeof count === 'number'
                      ? ` (${count.toLocaleString('pt-BR')})`
                      : ''}
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Tipo
            </label>
            <select
              value={selectedType}
              onChange={(event) =>
                onSelectedTypeChange(
                  event.target.value as ResearcherTypeFilter | '',
                )
              }
              className="w-full cursor-pointer rounded border border-border-subtle bg-surface px-2.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {TYPE_OPTIONS.map((type) => {
                const count = type.value ? getTypeCount(type.value) : null

                return (
                  <option key={type.value || 'all'} value={type.value}>
                    {type.label}
                    {typeof count === 'number'
                      ? ` (${count.toLocaleString('pt-BR')})`
                      : ''}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>
    </aside>
  )
}
