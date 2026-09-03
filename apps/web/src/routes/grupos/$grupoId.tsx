import {
  getResearchGroupDetail,
  researchGroupDetailQueryKey,
} from '#/api/grupos-pesquisa'
import { createFileRoute } from '@tanstack/react-router'
import { ContactInfo } from './-components/ContactInfo'
import { GroupHero } from './-components/GroupHero'
import { GroupLeaders } from './-components/GroupLeaders'
import { GroupMembers } from './-components/GroupMembers'
import { InstitutionalAffiliation } from './-components/InstitutionalAffiliation'
import { ResearchLines } from './-components/ResearcherLinks'

export const Route = createFileRoute('/grupos/$grupoId')({
  loader: ({ context, params }) =>
    context.queryClient.query({
      queryKey: researchGroupDetailQueryKey(params.grupoId),
      queryFn: () => getResearchGroupDetail(params.grupoId),
      staleTime: 'static',
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
  const group = Route.useLoaderData()

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
