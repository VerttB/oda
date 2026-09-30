import type {
  ResearchGroupSortField,
  ResearchGroupsDirectoryMetrics,
} from '#/api/grupos-pesquisa'
import type { SortOrder } from '#/api/sorting'
import { Button } from '#/components/ui/button'
import type { DirectoryGroupItem } from '#/core/interfaces'
import { useEffect, useMemo, useState, type FC } from 'react'

import { DirectoryFilterSidebar } from './GroupFilterSidebar'
import { GroupMainPageListItem } from './GroupMainPageListItem'
import { DirectoryPagination } from './GroupMainPagePagination'
import { GroupMainPageStats } from './GroupMainPageStats'

interface GroupMainPageProps {
  groups: DirectoryGroupItem[]
  metrics?: ResearchGroupsDirectoryMetrics
  onSelectGroup: (group: DirectoryGroupItem) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  sortField: ResearchGroupSortField
  onSortFieldChange: (field: ResearchGroupSortField) => void
  sortOrder: SortOrder
  onSortOrderChange: (order: SortOrder) => void
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
  sortField,
  onSortFieldChange,
  sortOrder,
  onSortOrderChange,
}) => {
  const [selectedUf, setSelectedUf] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredGroups = useMemo(() => {
    const filtered = groups.filter((group) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matches =
          group.name.toLowerCase().includes(query) ||
          group.institution.toLowerCase().includes(query) ||
          group.knowledgeArea.toLowerCase().includes(query) ||
          (group.description?.toLowerCase().includes(query) ?? false)

        if (!matches) {
          return false
        }
      }

      if (selectedUf && group.uf !== selectedUf) {
        return false
      }

      if (selectedArea && group.knowledgeArea !== selectedArea) {
        return false
      }

      return selectedStatus === 'Todos' || group.status === selectedStatus
    })

    return filtered.sort((first, second) => {
      let comparison = 0

      if (sortField === 'nome') {
        comparison = first.name.localeCompare(second.name, 'pt-BR')
      } else if (sortField === 'anoFormacao') {
        comparison = parseGroupYear(first.since) - parseGroupYear(second.since)
      } else {
        comparison = first.status.localeCompare(second.status, 'pt-BR')
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [
    groups,
    searchQuery,
    selectedArea,
    selectedStatus,
    selectedUf,
    sortField,
    sortOrder,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE))
  const pageStart =
    filteredGroups.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredGroups.length)
  const paginatedGroups = filteredGroups.slice(pageStart - 1, pageEnd)

  useEffect(() => {
    setCurrentPage(1)
  }, [
    searchQuery,
    selectedUf,
    selectedArea,
    selectedStatus,
    sortField,
    sortOrder,
  ])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const handleClearFilters = () => {
    onSearchChange('')
    setSelectedUf('')
    setSelectedArea('')
    setSelectedStatus('Todos')
    onSortFieldChange('nome')
    onSortOrderChange('asc')
    setCurrentPage(1)
  }

  return (
    <div id="directory-page" className="w-full flex-grow">
      <GroupMainPageStats
        totalCount={(metrics?.total ?? groups.length).toLocaleString('pt-BR')}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
       

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
            sortField={sortField}
            onSortFieldChange={onSortFieldChange}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
          />

          <div className="flex w-full flex-1 flex-col">
            <div className="mb-6 flex flex-col gap-3 border-b border-border-subtle pb-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">
                Exibindo {pageStart}-{pageEnd} de{' '}
                {filteredGroups.length.toLocaleString('pt-BR')} resultados
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Ordenar por:
                </span>
                <select
                  value={sortField}
                  onChange={(event) =>
                    onSortFieldChange(
                      event.target.value as ResearchGroupSortField,
                    )
                  }
                  className="cursor-pointer border-none bg-transparent px-2 py-1 text-xs font-semibold text-primary focus:outline-hidden"
                >
                  <option value="nome">Nome</option>
                  <option value="anoFormacao">Ano de formação</option>
                  <option value="situacao">Situação</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(event) =>
                    onSortOrderChange(event.target.value as SortOrder)
                  }
                  aria-label="Ordem"
                  className="cursor-pointer border-none bg-transparent px-2 py-1 text-xs font-semibold text-primary focus:outline-hidden"
                >
                  <option value="asc">Crescente</option>
                  <option value="desc">Decrescente</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col divide-y divide-border-subtle">
              {filteredGroups.length === 0 ? (
                <div className="py-16 text-center text-secondary">
                  <p className="text-sm font-medium">
                    Nenhum grupo encontrado com os filtros selecionados.
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={handleClearFilters}
                    className="mt-3"
                  >
                    Limpar filtros
                  </Button>
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
