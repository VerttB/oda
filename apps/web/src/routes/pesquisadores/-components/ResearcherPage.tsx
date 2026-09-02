import type {
  ResearcherDegreeFilter,
  ResearchersMetrics,
  ResearchersPage as ResearchersPageData,
  ResearcherTypeFilter,
} from '#/api/pesquisadores'
import type { ResearcherItem } from '#/core/interfaces'
import { RotateCcw, UserCheck } from 'lucide-react'
import { useMemo, useState, type FC } from 'react'

import { ResearcherListItem } from './ResearcherListItem'
import { ResearchersFilterSidebar } from './ResearcherFilterSidebar'
import { ResearchersPagination } from './ResearcherPagination'
import { ResearcherStats } from './ResearcherStats'
import { ResearchersTopInstitutionsBand } from './ResearcherTopInstitutions'

interface ResearchersPageProps {
  researchersPage: ResearchersPageData
  metrics?: ResearchersMetrics
  onSelectResearcher: (researcher: ResearcherItem) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedDegree: ResearcherDegreeFilter | ''
  onSelectedDegreeChange: (degree: ResearcherDegreeFilter | '') => void
  selectedType: ResearcherTypeFilter | ''
  onSelectedTypeChange: (type: ResearcherTypeFilter | '') => void
  currentPage: number
  onPageChange: (page: number) => void
}

export const ResearchersPage: FC<ResearchersPageProps> = ({
  researchersPage,
  metrics,
  onSelectResearcher,
  searchQuery,
  onSearchChange,
  selectedDegree,
  onSelectedDegreeChange,
  selectedType,
  onSelectedTypeChange,
  currentPage,
  onPageChange,
}) => {
  const [sortBy, setSortBy] = useState<
    'relevancia' | 'alfabetica' | 'producoes' | 'citacoes'
  >('relevancia')

  const filteredResearchers = useMemo(() => {
    return [...researchersPage.data].sort((a, b) => {
      if (sortBy === 'relevancia') {
        return (
          b.hIndex * 100 +
          b.citationsCount -
          (a.hIndex * 100 + a.citationsCount)
        )
      }

      if (sortBy === 'alfabetica') {
        return a.name.localeCompare(b.name)
      }

      if (sortBy === 'producoes') {
        return (b.productionsCount ?? 0) - (a.productionsCount ?? 0)
      }

      if (sortBy === 'citacoes') {
        return (b.citationsCount ?? 0) - (a.citationsCount ?? 0)
      }

      return 0
    })
  }, [researchersPage.data, sortBy])

  const handleClearFilters = () => {
    onSearchChange('')
    onSelectedDegreeChange('')
    onSelectedTypeChange('')
    onPageChange(1)
  }

  const pageStart =
    researchersPage.meta.totalItems === 0
      ? 0
      : (researchersPage.meta.page - 1) * researchersPage.meta.size + 1
  const pageEnd = Math.min(
    researchersPage.meta.page * researchersPage.meta.size,
    researchersPage.meta.totalItems,
  )

  return (
    <div
      id="researchers-directory-page"
      className="flex w-full flex-grow flex-col"
    >
      <ResearcherStats
        totalIndexed={(
          metrics?.totalResearchers ?? researchersPage.meta.totalItems
        ).toLocaleString('pt-BR')}
        totalWithOrcid={metrics?.totalWithOrcid.toLocaleString('pt-BR')}
      />

      <ResearchersTopInstitutionsBand metrics={metrics} />

      <main className="mx-auto flex w-full max-w-7xl flex-grow flex-col gap-6 px-4 py-8 md:flex-row md:px-10">
        <ResearchersFilterSidebar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          selectedDegree={selectedDegree}
          onSelectedDegreeChange={onSelectedDegreeChange}
          selectedType={selectedType}
          onSelectedTypeChange={onSelectedTypeChange}
          onClearFilters={handleClearFilters}
          metrics={metrics}
        />

        <div className="flex min-w-0 flex-grow flex-col gap-3">
          <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-secondary">
              Mostrando {pageStart}-{pageEnd} de{' '}
              {researchersPage.meta.totalItems.toLocaleString('pt-BR')}{' '}
              resultados
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as typeof sortBy)
                }
                className="cursor-pointer rounded-lg border border-border-subtle bg-background px-3 py-1 text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="relevancia">Relevância</option>
                <option value="alfabetica">Ordem alfabética</option>
                <option value="producoes">Produções</option>
                <option value="citacoes">Mais citados</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {filteredResearchers.length === 0 ? (
              <div className="bg-surface p-6 py-16 text-center text-secondary">
                <UserCheck className="mx-auto mb-3 h-10 w-10 text-secondary/40" />
                <p className="text-sm font-semibold text-primary">
                  Nenhum pesquisador encontrado
                </p>
                <p className="mt-1 text-xs text-secondary">
                  Tente ajustar o nome, a formação ou o tipo selecionado.
                </p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar filtros</span>
                </button>
              </div>
            ) : (
              filteredResearchers.map((researcher) => (
                <ResearcherListItem
                  key={researcher.id}
                  researcher={researcher}
                  onSelect={onSelectResearcher}
                />
              ))
            )}
          </div>

          <ResearchersPagination
            currentPage={currentPage}
            onPageChange={onPageChange}
            totalPages={researchersPage.meta.totalPages}
          />
        </div>
      </main>
    </div>
  )
}
