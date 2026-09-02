import type { ProductionsPage, ProductionTypeFilter } from '#/api/producoes'
import type { ProductionItem } from '#/core/interfaces'
import { FileText, RotateCcw } from 'lucide-react'
import { useMemo, useState, type MouseEvent, type FC } from 'react'

import { ProductionsFilterSidebar } from './ProductionFilterSidebar'
import { ProductionsListItem } from './ProductionListItem'
import { ProductionsPagination } from './ProductionPagination'
import { ProductionStats } from './ProductionStats'
import { ProductionsTopInstitutionsBand } from './ProductionTopInstitutions'

interface ProductionMainPageProps {
  productionsPage: ProductionsPage
  onSelectProduction: (item: ProductionItem) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedType: ProductionTypeFilter | ''
  onSelectedTypeChange: (type: ProductionTypeFilter | '') => void
  currentPage: number
  onPageChange: (page: number) => void
}

function parseProductionYear(value: ProductionItem['year']) {
  const year =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10)

  return Number.isNaN(year) ? 0 : year
}

export const ProductionMainPage: FC<ProductionMainPageProps> = ({
  productionsPage,
  onSelectProduction,
  searchQuery,
  onSearchChange,
  selectedType,
  onSelectedTypeChange,
  currentPage,
  onPageChange,
}) => {
  const [selectedQualis, setSelectedQualis] = useState<string[]>([])
  const [yearFrom, setYearFrom] = useState<string>('')
  const [yearTo, setYearTo] = useState<string>('')
  const [selectedInstitution, setSelectedInstitution] = useState(
    'Todas as instituições',
  )
  const [sortBy, setSortBy] = useState<'recentes' | 'citacoes' | 'titulo'>(
    'recentes',
  )
  const [copiedCitationId, setCopiedCitationId] = useState<string | null>(null)

  const handleToggleQualis = (qualis: string) => {
    setSelectedQualis((previous) =>
      previous.includes(qualis)
        ? previous.filter((item) => item !== qualis)
        : [...previous, qualis],
    )
  }

  const handleCopyCitation = (
    production: ProductionItem,
    event: MouseEvent,
  ) => {
    event.stopPropagation()

    const authorsFormatted = Array.isArray(production.authors)
      ? production.authors.join('; ')
      : production.authors
    const venue = production.journalOrConference ?? production.venue ?? ''
    const citation = `${authorsFormatted}. ${production.title}. ${venue}, ${production.year}.${production.doi ? ` DOI: https://doi.org/${production.doi}` : ''}`

    void navigator.clipboard.writeText(citation)
    setCopiedCitationId(production.id)
    window.setTimeout(() => setCopiedCitationId(null), 2500)
  }

  const handleResetFilters = () => {
    onSearchChange('')
    onSelectedTypeChange('')
    setSelectedQualis([])
    setYearFrom('')
    setYearTo('')
    setSelectedInstitution('Todas as instituições')
    onPageChange(1)
  }

  const filteredProductions = useMemo(() => {
    return productionsPage.data
      .filter((production) => {
        if (selectedQualis.length > 0) {
          if (
            !production.qualis ||
            !selectedQualis.includes(production.qualis)
          ) {
            return false
          }
        }

        const year = parseProductionYear(production.year)

        if (yearFrom && year < Number.parseInt(yearFrom, 10)) {
          return false
        }

        if (yearTo && year > Number.parseInt(yearTo, 10)) {
          return false
        }

        if (selectedInstitution !== 'Todas as instituições') {
          return production.institution === selectedInstitution
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'recentes') {
          return parseProductionYear(b.year) - parseProductionYear(a.year)
        }

        if (sortBy === 'citacoes') {
          return (b.citations ?? 0) - (a.citations ?? 0)
        }

        return a.title.localeCompare(b.title)
      })
  }, [
    productionsPage.data,
    selectedQualis,
    yearFrom,
    yearTo,
    selectedInstitution,
    sortBy,
  ])

  const pageStart =
    productionsPage.meta.totalItems === 0
      ? 0
      : (productionsPage.meta.page - 1) * productionsPage.meta.size + 1
  const pageEnd = Math.min(
    productionsPage.meta.page * productionsPage.meta.size,
    productionsPage.meta.totalItems,
  )

  return (
    <div id="productions-page" className="flex w-full flex-grow flex-col">
      <ProductionStats
        totalCount={productionsPage.meta.totalItems.toLocaleString('pt-BR')}
      />

      <ProductionsTopInstitutionsBand
        selectedInstitution={selectedInstitution}
        onSelectInstitution={setSelectedInstitution}
      />

      <div className="mx-auto grid w-full max-w-7xl flex-grow grid-cols-1 gap-8 px-4 py-8 md:grid-cols-12 md:px-10">
        <ProductionsFilterSidebar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          selectedType={selectedType}
          onSelectedTypeChange={onSelectedTypeChange}
          selectedQualis={selectedQualis}
          onToggleQualis={handleToggleQualis}
          yearFrom={yearFrom}
          onYearFromChange={setYearFrom}
          yearTo={yearTo}
          onYearToChange={setYearTo}
          selectedInstitution={selectedInstitution}
          onInstitutionChange={setSelectedInstitution}
          onResetFilters={handleResetFilters}
          onApplyFilters={() => onPageChange(1)}
        />

        <section className="md:col-span-9">
          <div className="mb-4 flex flex-col gap-3 border-b border-border-subtle pb-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Mostrando {pageStart}-{pageEnd} de{' '}
              {productionsPage.meta.totalItems.toLocaleString('pt-BR')}{' '}
              resultados
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">
                Ordenar por:
              </span>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as typeof sortBy)
                }
                className="cursor-pointer border-none bg-transparent p-0 pr-4 text-xs font-semibold text-primary focus:ring-0"
              >
                <option value="recentes">Mais recentes</option>
                <option value="citacoes">Mais citadas</option>
                <option value="titulo">Título</option>
              </select>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-border-subtle">
            {filteredProductions.length === 0 ? (
              <div className="mt-2 rounded-lg border border-border-subtle bg-background py-16 text-center text-muted-foreground">
                <FileText className="mx-auto mb-3 h-10 w-10 text-secondary/40" />
                <p className="text-sm font-semibold text-primary">
                  Nenhuma produção encontrada
                </p>
                <p className="mt-1 text-xs text-secondary">
                  Tente ajustar os termos de busca, anos ou filtros de Qualis.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar filtros</span>
                </button>
              </div>
            ) : (
              filteredProductions.map((production) => (
                <ProductionsListItem
                  key={production.id}
                  production={production}
                  onSelect={onSelectProduction}
                  copiedCitationId={copiedCitationId}
                  onCopyCitation={handleCopyCitation}
                />
              ))
            )}
          </div>

          <ProductionsPagination
            currentPage={currentPage}
            onPageChange={onPageChange}
            totalPages={productionsPage.meta.totalPages}
          />
        </section>
      </div>
    </div>
  )
}
