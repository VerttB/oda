import type {
  ResearcherDegreeFilter,
  ResearchersMetrics,
  ResearcherTypeFilter,
} from '#/api/pesquisadores'
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
            <button
              type="button"
              onClick={onClearFilters}
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
              Nome do pesquisador
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome"
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
