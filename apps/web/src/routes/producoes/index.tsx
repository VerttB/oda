import {
  getProductions,
  productionsQueryKey,
  type ProductionSortField,
  type ProductionTypeFilter,
  type ProductionsFilters,
} from '#/api/producoes'
import type { SortOrder } from '#/api/sorting'
import { Button } from '#/components/ui/button'
import type { ProductionItem } from '#/core/interfaces'
import { createFileRoute } from '@tanstack/react-router'
import { ProductionMainPage } from './-components/ProductionMainPage'

const PAGE_SIZE = 30

type ProductionsSearch = {
  page?: number
  q?: string
  tipo?: ProductionTypeFilter
  ordenarPor?: ProductionSortField
  ordem?: SortOrder
}

function isProductionTypeFilter(value: unknown): value is ProductionTypeFilter {
  return value === 'ARTIGO' || value === 'LIVROCAPITULO' || value === 'OUTRA'
}

function isProductionSortField(value: unknown): value is ProductionSortField {
  return (
    value === 'titulo' ||
    value === 'ano' ||
    value === 'tipo' ||
    value === 'qualis'
  )
}

function isSortOrder(value: unknown): value is SortOrder {
  return value === 'asc' || value === 'desc'
}
function parseProductionsSearch(
  search: Record<string, unknown>,
): ProductionsSearch {
  const page = Number(search.page)

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    q: typeof search.q === 'string' ? search.q : '',
    tipo: isProductionTypeFilter(search.tipo) ? search.tipo : undefined,
    ordenarPor: isProductionSortField(search.ordenarPor)
      ? search.ordenarPor
      : 'ano',
    ordem: isSortOrder(search.ordem) ? search.ordem : 'desc',
  }
}

function getProductionsFilters(search: ProductionsSearch): ProductionsFilters {
  return {
    page: search.page ?? 1,
    size: PAGE_SIZE,
    titulo: search.q,
    tipo: search.tipo,
    ordenarPor: search.ordenarPor ?? 'ano',
    ordem: search.ordem ?? 'desc',
  }
}

export const Route = createFileRoute('/producoes/')({
  validateSearch: parseProductionsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const filters = getProductionsFilters(deps)

    return context.queryClient.query({
      queryKey: productionsQueryKey(filters),
      queryFn: () => getProductions(filters),
      staleTime: 'static',
    })
  },
  pendingComponent: ProductionsPendingState,
  errorComponent: ({ error, reset }) => (
    <ProductionsErrorState error={error} onRetry={reset} />
  ),
  component: ProductionsRoute,
})

function ProductionsPendingState() {
  return (
    <main className="bg-background pt-28">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
        <div className="h-40 animate-pulse rounded-lg bg-surface" />
        <div className="mt-10 grid gap-8 md:grid-cols-12">
          <div className="h-96 animate-pulse rounded-lg bg-surface md:col-span-3" />
          <div className="space-y-4 md:col-span-9">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg bg-surface"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

function ProductionsErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  return (
    <main className="bg-background pt-28">
      <section className="mx-auto max-w-[780px] px-4 py-16 text-center md:px-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
          Produções indisponíveis
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-secondary">
          Não foi possível carregar as produções.
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {error instanceof Error
            ? error.message
            : 'A API retornou uma resposta inesperada.'}
        </p>
        <Button type="button" onClick={onRetry} size="lg">
          Tentar novamente
        </Button>
      </section>
    </main>
  )
}

function ProductionsRoute() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const productionsPage = Route.useLoaderData()

  const updateSearch = (nextSearch: Partial<ProductionsSearch>) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        ...nextSearch,
      }),
    })

  const handleSelectProduction = (production: ProductionItem) => {
    void navigate({
      to: '/producoes/$producaoId',
      params: { producaoId: production.id },
    })
  }

  return (
    <ProductionMainPage
      productionsPage={productionsPage}
      onSelectProduction={handleSelectProduction}
      searchQuery={search.q ?? ''}
      onSearchChange={(q) => updateSearch({ q, page: 1 })}
      selectedType={search.tipo ?? ''}
      onSelectedTypeChange={(tipo) =>
        updateSearch({ tipo: tipo || undefined, page: 1 })
      }
      sortField={search.ordenarPor ?? 'ano'}
      onSortFieldChange={(ordenarPor) => updateSearch({ ordenarPor, page: 1 })}
      sortOrder={search.ordem ?? 'desc'}
      onSortOrderChange={(ordem) => updateSearch({ ordem, page: 1 })}
      currentPage={search.page ?? 1}
      onPageChange={(page) => updateSearch({ page })}
    />
  )
}
