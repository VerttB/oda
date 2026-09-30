import {
  featuredResearchGroupsQueryKey,
  getFeaturedResearchGroups,
} from '#/api/grupos-pesquisa'
import { generalMetricsQueryKey, getGeneralMetrics } from '#/api/metricas'
import { getProductions, productionsQueryKey } from '#/api/producoes'
import { ApiBanner } from '#/components/ApiBanner'
import { HeroMetrics } from '#/components/HeroMetrics'
import { ProductionHighlights } from '#/components/ProductionHighlights'
import { ResearchGroupCards } from '#/components/ResearchGroupCards'
import { Button } from '#/components/ui/button'
import type { ProductionItem } from '#/core/interfaces'
import { createFileRoute } from '@tanstack/react-router'

const FEATURED_GROUPS_SIZE = 6
const FEATURED_PRODUCTIONS_FILTERS = { page: 1, size: 4 } as const

export const Route = createFileRoute('/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query({
        queryKey: generalMetricsQueryKey,
        queryFn: getGeneralMetrics,
        staleTime: 'static',
      }),
      context.queryClient.query({
        queryKey: productionsQueryKey(FEATURED_PRODUCTIONS_FILTERS),
        queryFn: () => getProductions(FEATURED_PRODUCTIONS_FILTERS),
        staleTime: 'static',
      }),
      context.queryClient.query({
        queryKey: featuredResearchGroupsQueryKey,
        queryFn: () => getFeaturedResearchGroups(FEATURED_GROUPS_SIZE),
        staleTime: 'static',
      }),
    ]),
  pendingComponent: DiscoverPendingState,
  errorComponent: ({ error, reset }) => (
    <DiscoverErrorState error={error} onRetry={reset} />
  ),
  component: DiscoverRoute,
})

function DiscoverPendingState() {
  return (
    <main className="bg-background pt-28">
      <div className="mx-auto max-w-[1280px] space-y-8 px-4 py-12 md:px-10">
        <div className="h-80 animate-pulse rounded-lg bg-secondary/90" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-lg bg-surface"
            />
          ))}
        </div>
      </div>
    </main>
  )
}

function DiscoverErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  return (
    <main className="bg-background pt-28">
      <section className="mx-auto max-w-[780px] px-4 py-20 text-center md:px-10">
        <p className="mb-3 text-xs font-semibold tracking-wider text-primary uppercase">
          Dados indisponíveis
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-normal text-secondary">
          Não foi possível carregar a página Descobrir.
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

function DiscoverRoute() {
  const navigate = Route.useNavigate()
  const [metrics, productionsPage, groupsPage] = Route.useLoaderData()

  function selectProduction(production: ProductionItem) {
    void navigate({
      to: '/producoes/$producaoId',
      params: { producaoId: production.id },
    })
  }

  return (
    <>
      <HeroMetrics metrics={metrics} />
      <ApiBanner />
      <main className="bg-background">
        <div className="mx-auto max-w-[1280px] space-y-16 px-4 py-16 md:px-10">
          <ProductionHighlights
            productions={productionsPage.data}
            metrics={metrics}
            onSelectProduction={selectProduction}
            onViewAll={() => void navigate({ to: '/producoes' })}
          />

          <ResearchGroupCards
            groups={groupsPage.data}
            onSelectGroup={(grupoId) =>
              void navigate({
                to: '/grupos/$grupoId',
                params: { grupoId },
              })
            }
            onExploreAllGroups={() => void navigate({ to: '/grupos' })}
          />
        </div>
      </main>
    </>
  )
}
