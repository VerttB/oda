import { getProductionDetail, productionDetailQueryKey } from '#/api/producoes'
import type {
  AcademicAuthor,
  AcademicProductionDetailData,
} from '#/core/interfaces'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { AcademicProductionAbstract } from './-components/AcademicProductionAbstract'
import { AcademicProductionAuthors } from './-components/AcademicProductionAuthors'
import { AcademicProductionHeader } from './-components/AcademicProductionHeader'
import { AcademicProductionKeywords } from './-components/AcademicProductionKeywords'
import { AcademicProductionMetadata } from './-components/AcademicProductionMetadata'

export const Route = createFileRoute('/producoes/$producaoId')({
  loader: ({ context, params }) =>
    context.queryClient.query({
      queryKey: productionDetailQueryKey(params.producaoId),
      queryFn: () => getProductionDetail(params.producaoId),
      staleTime: 'static',
    }),
  component: AcademicProductionRoute,
  errorComponent: ({ error, reset }) => (
    <ProductionErrorState error={error} onRetry={reset} />
  ),
})

function ProductionErrorState({
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
          Produção indisponível
        </p>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-secondary">
          Não foi possível carregar os dados desta produção.
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

function AcademicProductionRoute() {
  const navigate = Route.useNavigate()
  const production = Route.useLoaderData()

  const currentData = useMemo<AcademicProductionDetailData>(
    () => production,
    [production],
  )

  const handleBack = () => {
    void navigate({ to: '/producoes' })
  }

  const handleSelectAuthor = (author: AcademicAuthor) => {
    if (!author.id) {
      return
    }

    void navigate({
      to: '/pesquisadores',
      search: {
        q: author.name,
        page: 1,
      },
    })
  }

  const handleSelectKeyword = (keyword: string) => {
    void navigate({
      to: '/producoes',
      search: {
        q: keyword,
        page: 1,
      },
    })
  }

  return (
    <div
      id="academic-production-canvas"
      className="flex w-full flex-grow flex-col bg-background pt-28"
    >
      <main className="mx-auto grid w-full max-w-7xl flex-grow grid-cols-1 gap-6 px-4 py-8 md:grid-cols-12 md:px-10">
        <AcademicProductionHeader
          type={currentData.type}
          year={currentData.year}
          title={currentData.title}
          onBack={handleBack}
          isOpenAccess={currentData.isOpenAccess || currentData.openAccess}
        />

        <article className="flex flex-col gap-6 md:col-span-8">
          <AcademicProductionAuthors
            authors={currentData.authors}
            onSelectAuthor={handleSelectAuthor}
          />

          <AcademicProductionAbstract abstract={currentData.abstract} />

          <AcademicProductionKeywords
            keywords={currentData.keywords}
            onSelectKeyword={handleSelectKeyword}
          />
        </article>

        <aside className="flex flex-col gap-6 md:col-span-4">
          <AcademicProductionMetadata
            journal={currentData.journal}
            issn={currentData.issn}
            doi={currentData.doi}
            qualis={currentData.qualis}
            qualisArea={currentData.qualisArea}
            pages={currentData.pages}
            groupName={currentData.groupName}
            institution={currentData.institution}
            citationsCount={currentData.citations}
          />
        </aside>
      </main>
    </div>
  )
}
