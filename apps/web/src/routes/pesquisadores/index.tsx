import {
  getResearchers,
  getResearchersMetrics,
  researchersMetricsQueryKey,
  researchersQueryKey,
  type ResearcherDegreeFilter,
  type ResearchersFilters,
  type ResearcherTypeFilter,
} from '#/api/pesquisadores'
import type { ResearcherItem } from '#/core/interfaces'
import { createFileRoute } from '@tanstack/react-router'
import { ResearchersPage } from './-components/ResearcherPage'

const PAGE_SIZE = 30

type ResearchersSearch = {
  page?: number
  q?: string
  formacao?: ResearcherDegreeFilter
  tipo?: ResearcherTypeFilter
}

function isResearcherDegreeFilter(
  value: unknown,
): value is ResearcherDegreeFilter {
  return (
    value === 'GRADUACAO' ||
    value === 'ESPECIALIZACAO' ||
    value === 'MESTRADO' ||
    value === 'DOUTORADO' ||
    value === 'OUTRO'
  )
}

function isResearcherTypeFilter(value: unknown): value is ResearcherTypeFilter {
  return (
    value === 'TECNICO' ||
    value === 'ESTUDANTE' ||
    value === 'PESQUISADOR' ||
    value === 'COLABORADOR_ESTRANGEIRO'
  )
}

function parseResearchersSearch(
  search: Record<string, unknown>,
): ResearchersSearch {
  const page = Number(search.page)

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    q: typeof search.q === 'string' ? search.q : '',
    formacao: isResearcherDegreeFilter(search.formacao)
      ? search.formacao
      : undefined,
    tipo: isResearcherTypeFilter(search.tipo) ? search.tipo : undefined,
  }
}

function getResearchersFilters(search: ResearchersSearch): ResearchersFilters {
  return {
    page: search.page ?? 1,
    size: PAGE_SIZE,
    nome: search.q,
    formacaoAcademica: search.formacao,
    tipo: search.tipo,
  }
}

export const Route = createFileRoute('/pesquisadores/')({
  validateSearch: parseResearchersSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const filters = getResearchersFilters(deps)

    return Promise.all([
      context.queryClient.query({
        queryKey: researchersQueryKey(filters),
        queryFn: () => getResearchers(filters),
        staleTime: 'static',
      }),
      context.queryClient.query({
        queryKey: researchersMetricsQueryKey,
        queryFn: getResearchersMetrics,
        staleTime: 'static',
      }),
    ])
  },
  pendingComponent: ResearchersPendingState,
  errorComponent: ({ error, reset }) => (
    <ResearchersErrorState error={error} onRetry={reset} />
  ),
  component: ResearchersRoute,
})

function ResearchersPendingState() {
  return (
    <main className="bg-background pt-28">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
        <div className="h-40 animate-pulse rounded-lg bg-surface" />
        <div className="mt-10 flex flex-col gap-6 md:flex-row">
          <div className="h-96 animate-pulse rounded-lg bg-surface md:w-72" />
          <div className="flex-1 space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-lg bg-surface"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

function ResearchersErrorState({
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
          Pesquisadores indisponíveis
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-secondary">
          Não foi possível carregar os pesquisadores.
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

function ResearchersRoute() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const [researchersPage, metrics] = Route.useLoaderData()

  const updateSearch = (nextSearch: ResearchersSearch) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        ...nextSearch,
      }),
    })

  const handleSelectResearcher = (researcher: ResearcherItem) => {
    if (researcher.lattesId) {
      window.open(
        `http://lattes.cnpq.br/${researcher.lattesId}`,
        '_blank',
        'noopener,noreferrer',
      )
    }
  }

  return (
    <ResearchersPage
      researchersPage={researchersPage}
      metrics={metrics}
      onSelectResearcher={handleSelectResearcher}
      searchQuery={search.q ?? ''}
      onSearchChange={(q) => updateSearch({ q, page: 1 })}
      selectedDegree={search.formacao ?? ''}
      onSelectedDegreeChange={(formacao) =>
        updateSearch({ formacao: formacao || undefined, page: 1 })
      }
      selectedType={search.tipo ?? ''}
      onSelectedTypeChange={(tipo) =>
        updateSearch({ tipo: tipo || undefined, page: 1 })
      }
      currentPage={search.page ?? 1}
      onPageChange={(page) => updateSearch({ page })}
    />
  )
}
