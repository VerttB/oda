import type { LangchainResponse } from '@oda/shared-types'
import { ArrowUpRight, BookOpen } from 'lucide-react'

const labels = {
  grupo_pesquisa: 'Grupo de pesquisa',
  linha_pesquisa: 'Linha de pesquisa',
  pesquisador: 'Pesquisador',
  producao: 'Produção acadêmica',
  area_conhecimento: 'Área de conhecimento',
}

export function AssistantSources({
  sources,
}: {
  sources: NonNullable<LangchainResponse['sources']>
}) {
  return (
    <details className="mt-5 rounded-lg border border-border-subtle bg-background">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">
        <BookOpen className="mr-2 inline size-4" /> Fontes consultadas (
        {sources.length})
      </summary>
      <ol className="space-y-3 border-t border-border-subtle p-4">
        {sources.map((source, index) => {
          const path =
            source.sourceType === 'grupo_pesquisa'
              ? 'grupos'
              : source.sourceType === 'producao'
                ? 'producoes'
                : null
          return (
            <li
              key={`${source.ref}-${index}`}
              className="rounded-lg bg-surface p-4 text-sm"
            >
              <p className="text-xs text-muted-foreground">
                {source.ref.startsWith('[') ? source.ref : `[${source.ref}]`} ·{' '}
                {labels[source.sourceType]}
              </p>
              <h4 className="mt-1 font-semibold text-secondary">
                {source.title}
              </h4>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {source.excerpt}
              </p>
              {path && (
                <a
                  href={`/${path}/${encodeURIComponent(source.sourceId)}`}
                  className="mt-3 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Ver registro <ArrowUpRight className="size-4" />
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </details>
  )
}
