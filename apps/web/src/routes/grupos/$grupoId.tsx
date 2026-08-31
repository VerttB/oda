import { ContactInfo } from '#/components/grupo/ContactInfo'
import { GroupHero } from '#/components/grupo/GroupHero'
import { GroupLeaders } from '#/components/grupo/GroupLeaders'
import { GroupMembers } from '#/components/grupo/GroupMembers'
import { InstitutionalAffiliation } from '#/components/grupo/InstitutionalAffiliation'
import { ResearchLines } from '#/components/grupo/ResearcherLinks'
import {
  getResearchGroupDetail,
  researchGroupDetailQueryKey,
} from '#/api/grupos-pesquisa'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/grupos/$grupoId')({
  loader: ({ context, params }) =>
    context.queryClient.query({
      queryKey: researchGroupDetailQueryKey(params.grupoId),
      queryFn: () => getResearchGroupDetail(params.grupoId),
    }),
  component: RouteComponent,
  errorComponent: ({ error, reset }) => (
    <GroupErrorState error={error} onRetry={reset} />
  ),
})

function GroupErrorState({
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
          Grupo não encontrado
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-secondary">
          Não foi possível carregar os dados deste grupo.
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

function RouteComponent() {
  const { grupoId } = Route.useParams()
  const {
    data: group,
    error,
    isError,
    isPending,
    refetch,
  } = useQuery({
    queryKey: researchGroupDetailQueryKey(grupoId),
    queryFn: () => getResearchGroupDetail(grupoId),
  })

  if (isPending) {
    return (
      <main className="bg-background pt-28">
        <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-10">
          <div className="h-64 animate-pulse rounded-lg bg-surface" />
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="h-40 animate-pulse rounded-lg bg-surface" />
            <div className="h-40 animate-pulse rounded-lg bg-surface md:col-span-2" />
          </div>
        </div>
      </main>
    )
  }

  if (isError) {
    return <GroupErrorState error={error} onRetry={() => void refetch()} />
  }

  return (
    <div>
      <GroupHero group={group} />

      <div className="mx-auto max-w-[1600px] space-y-12 px-4 py-12 md:px-10">
        <InstitutionalAffiliation
          hostInstitution={group.institutionalAffiliation.hostInstitution}
          partnerInstitutions={
            group.institutionalAffiliation.partnerInstitutions
          }
        />

        <ContactInfo
          email={group.contactInfo.email}
          socialHandle={group.contactInfo.socialHandle}
          website={group.contactInfo.website}
        />

        <ResearchLines researchLines={group.researchLines} />

        <GroupLeaders leaders={group.leaders} />

        <GroupMembers members={group.members} />
      </div>
    </div>
  )
}
