import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import {
  getResearchGroupsMetrics,
  getResearchGroups,
  researchGroupsMetricsQueryKey,
  researchGroupsQueryKey,
} from '#/api/grupos-pesquisa'
import { GroupMainPage } from './-components/GroupMainPage'

export const Route = createFileRoute('/grupos/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query({
        queryKey: researchGroupsQueryKey,
        queryFn: getResearchGroups,
        staleTime: 'static',
      }),
      context.queryClient.query({
        queryKey: researchGroupsMetricsQueryKey,
        queryFn: getResearchGroupsMetrics,
        staleTime: 'static',
      }),
    ]),
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

function GroupsRoute() {
  const navigate = Route.useNavigate()
  const [groups, metrics] = Route.useLoaderData()
  const [searchQuery, setSearchQuery] = useState('')

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
    />
  )
}
