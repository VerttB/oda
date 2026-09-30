import {
  getResearchGroups,
  getResearchGroupsMetrics,
  researchGroupsMetricsQueryKey,
  researchGroupsQueryKey,
  type ResearchGroupSortField,
  type ResearchGroupsFilters,
} from '#/api/grupos-pesquisa'
import type { SortOrder } from '#/api/sorting'
import { Button } from '#/components/ui/button'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { GroupMainPage } from './-components/GroupMainPage'

type GroupsSearch = {
  ordenarPor?: ResearchGroupSortField
  ordem?: SortOrder
}

function isResearchGroupSortField(
  value: unknown,
): value is ResearchGroupSortField {
  return value === 'nome' || value === 'anoFormacao' || value === 'situacao'
}

function isSortOrder(value: unknown): value is SortOrder {
  return value === 'asc' || value === 'desc'
}

function parseGroupsSearch(search: Record<string, unknown>): GroupsSearch {
  return {
    ordenarPor: isResearchGroupSortField(search.ordenarPor)
      ? search.ordenarPor
      : 'nome',
    ordem: isSortOrder(search.ordem) ? search.ordem : 'asc',
  }
}

function getResearchGroupsFilters(search: GroupsSearch): ResearchGroupsFilters {
  return {
    ordenarPor: search.ordenarPor ?? 'nome',
    ordem: search.ordem ?? 'asc',
  }
}

export const Route = createFileRoute('/grupos/')({
  validateSearch: parseGroupsSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    const filters = getResearchGroupsFilters(deps)

    return Promise.all([
      context.queryClient.query({
        queryKey: researchGroupsQueryKey(filters),
        queryFn: () => getResearchGroups(filters),
        staleTime: 'static',
      }),
      context.queryClient.query({
        queryKey: researchGroupsMetricsQueryKey,
        queryFn: getResearchGroupsMetrics,
        staleTime: 'static',
      }),
    ])
  },
  component: GroupsRoute,
  pendingComponent: GroupsPendingState,
  errorComponent: ({ error, reset }) => (
    <GroupsErrorState error={error} onRetry={reset} />
  ),
})

function GroupsPendingState() {
  return (
    <main className="bg-background pt-28">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
        <div className="h-40 animate-pulse rounded-lg bg-surface" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
          <div className="h-96 animate-pulse rounded-lg bg-surface" />
          <div className="space-y-4">
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

function GroupsErrorState({
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
          Diretório indisponível
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-secondary">
          Não foi possível carregar os grupos de pesquisa.
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

function GroupsRoute() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const [groups, metrics] = Route.useLoaderData()
  const [searchQuery, setSearchQuery] = useState('')

  const updateSearch = (nextSearch: Partial<GroupsSearch>) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        ...nextSearch,
      }),
    })

  return (
    <GroupMainPage
      groups={groups}
      metrics={metrics}
      onSelectGroup={(group) =>
        void navigate({
          to: '/grupos/$grupoId',
          params: { grupoId: group.id },
        })
      }
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      sortField={search.ordenarPor ?? 'nome'}
      onSortFieldChange={(ordenarPor) => updateSearch({ ordenarPor })}
      sortOrder={search.ordem ?? 'asc'}
      onSortOrderChange={(ordem) => updateSearch({ ordem })}
    />
  )
}
