import {
  getProductions,
  productionsQueryKey,
  type ProductionTypeFilter,
  type ProductionsFilters,
} from '#/api/producoes'
import { ProductionMainPage } from '#/components/production/ProductionMainPage'
import type { ProductionItem } from '#/core/interfaces'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

const PAGE_SIZE = 30

type ProductionsSearch = {
  page?: number
  q?: string
  tipo?: ProductionTypeFilter
}

function isProductionTypeFilter(value: unknown): value is ProductionTypeFilter {
  return value === 'ARTIGO' || value === 'LIVROCAPITULO' || value === 'OUTRA'
}

function parseProductionsSearch(
  search: Record<string, unknown>,
): ProductionsSearch {
  const page = Number(search.page)

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    q: typeof search.q === 'string' ? search.q : '',
    tipo: isProductionTypeFilter(search.tipo) ? search.tipo : undefined,
  }
}

function getProductionsFilters(search: ProductionsSearch): ProductionsFilters {
  return {
    page: search.page ?? 1,
    size: PAGE_SIZE,
    titulo: search.q,
    tipo: search.tipo,
  }
}

export const Route = createFileRoute('/producoes/')({
  validateSearch: parseProductionsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const filters = getProductionsFilters(deps)

    return context.queryClient.ensureQueryData({
      queryKey: productionsQueryKey(filters),
      queryFn: () => getProductions(filters),
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
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  )
}

function ProductionsRoute() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const filters = getProductionsFilters(search)
  const { data: productionsPage } = useQuery({
    queryKey: productionsQueryKey(filters),
    queryFn: () => getProductions(filters),
  })

  if (!productionsPage) {
    return <ProductionsPendingState />
  }

  const updateSearch = (nextSearch: ProductionsSearch) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        ...nextSearch,
      }),
    })

  const handleSelectProduction = (production: ProductionItem) => {
    if (production.url) {
      window.open(production.url, '_blank', 'noopener,noreferrer')
    }
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
      currentPage={search.page ?? 1}
      onPageChange={(page) => updateSearch({ page })}
    />
  )
}
