import type { ResearchGroupsDirectoryMetrics } from '#/api/grupos-pesquisa'
import type { DirectoryGroupItem } from '#/core/interfaces'
import { useEffect, useMemo, useState, type FC } from 'react'
import { DirectoryFilterSidebar } from './GroupFilterSidebar'
import { DirectoryPagination } from './GroupMainPagePagination'
import { DirectoryTopUniversitiesBand } from './GroupMainPageTopUni'
import { GroupMainPageStats } from './GroupMainPageStats'
import { GroupMainPageListItem } from './GroupMainPageListItem'

interface GroupMainPageProps {
  groups: DirectoryGroupItem[]
  metrics?: ResearchGroupsDirectoryMetrics
  onSelectGroup: (group: DirectoryGroupItem) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

const PAGE_SIZE = 10

function parseGroupYear(value: string) {
  const year = Number.parseInt(value, 10)

  return Number.isNaN(year) ? 0 : year
}

export const GroupMainPage: FC<GroupMainPageProps> = ({
  groups,
  metrics,
  onSelectGroup,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedUf, setSelectedUf] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')
  const [sortBy, setSortBy] = useState<'Relevance' | 'Newest' | 'Name'>(
    'Relevance',
  )
  const [currentPage, setCurrentPage] = useState(1)

  const filteredGroups = useMemo(() => {
    return groups
      .filter((group) => {
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          const matchName = group.name.toLowerCase().includes(query)
          const matchInstitution = group.institution
            .toLowerCase()
            .includes(query)
          const matchArea = group.knowledgeArea.toLowerCase().includes(query)
          const matchDescription =
            group.description?.toLowerCase().includes(query) ?? false

          if (
            !matchName &&
            !matchInstitution &&
            !matchArea &&
            !matchDescription
          ) {
            return false
          }
        }

        if (selectedUf && group.uf !== selectedUf) {
          return false
        }

        if (selectedArea && group.knowledgeArea !== selectedArea) {
          return false
        }

        if (selectedStatus !== 'All' && group.status !== selectedStatus) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'Newest') {
          return parseGroupYear(b.since) - parseGroupYear(a.since)
        }

        if (sortBy === 'Name') {
          return a.name.localeCompare(b.name)
        }

        return 0
      })
  }, [groups, searchQuery, selectedUf, selectedArea, selectedStatus, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE))
  const pageStart =
    filteredGroups.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredGroups.length)
  const paginatedGroups = filteredGroups.slice(pageStart - 1, pageEnd)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedUf, selectedArea, selectedStatus, sortBy])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const handleClearFilters = () => {
    onSearchChange('')
    setSelectedUf('')
    setSelectedArea('')
    setSelectedStatus('All')
    setCurrentPage(1)
  }

  return (
    <div id="directory-page" className="w-full flex-grow">
      <GroupMainPageStats
        totalCount={(metrics?.total ?? groups.length).toLocaleString('pt-BR')}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
        <DirectoryTopUniversitiesBand
          institutions={metrics?.topInstitutions.slice(0, 5)}
          ufs={metrics?.topUfs.slice(0, 5)}
          onSelectUniversity={(uf) => setSelectedUf(uf)}
        />

        <div className="flex flex-col items-start gap-8 lg:flex-row">
          <DirectoryFilterSidebar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            selectedUf={selectedUf}
            onUfChange={setSelectedUf}
            selectedArea={selectedArea}
            onAreaChange={setSelectedArea}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            onClearFilters={handleClearFilters}
            onApplyFilters={() => setCurrentPage(1)}
          />

          <div className="flex w-full flex-1 flex-col">
            <div className="mb-6 flex items-center justify-between border-b border-border-subtle pb-2">
              <span className="text-xs text-muted-foreground">
                Exibindo {pageStart}-{pageEnd} de{' '}
                {filteredGroups.length.toLocaleString('pt-BR')} resultados
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Ordenar por:
                </span>
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as typeof sortBy)
                  }
                  className="cursor-pointer border-none bg-transparent px-2 py-1 text-xs font-semibold text-primary focus:outline-hidden"
                >
                  <option value="Relevance">Relevância</option>
                  <option value="Newest">Mais recentes</option>
                  <option value="Name">Ordem alfabética</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col divide-y divide-border-subtle">
              {filteredGroups.length === 0 ? (
                <div className="py-16 text-center text-secondary">
                  <p className="text-sm font-medium">
                    Nenhum grupo encontrado com os filtros selecionados.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="mt-3 cursor-pointer text-xs font-semibold text-primary hover:underline"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                paginatedGroups.map((item) => (
                  <GroupMainPageListItem
                    key={item.id}
                    group={item}
                    onSelect={onSelectGroup}
                  />
                ))
              )}
            </div>

            <DirectoryPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
