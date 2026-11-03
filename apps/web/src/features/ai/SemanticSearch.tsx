import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
} from 'lucide-react'
import { searchSemantic, semanticEntities, semanticLabels } from '#/api/ai'
import type { SemanticEntity } from '#/api/ai'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { AiFeedback } from './AiFeedback'

type Props = {
  active: boolean
  entity: SemanticEntity
  query: string
  page: number
  seconds: number
  onNavigate: (search: {
    entidade: SemanticEntity
    q: string
    page: number
  }) => void
  onError: (error: unknown) => void
}

const examples = [
  'Inteligência artificial aplicada à saúde',
  'Tecnologias para agricultura sustentável',
  'Educação inclusiva e acessibilidade',
]

export function SemanticSearch({
  active,
  entity,
  query,
  page,
  seconds,
  onNavigate,
  onError,
}: Props) {
  const [draft, setDraft] = useState(query)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => setDraft(query), [query])
  const result = useQuery({
    queryKey: ['ai-semantic', entity, query, page],
    queryFn: ({ signal }) => searchSemantic(entity, query, page, signal),
    // Uma falha só é repetida por ação explícita, inclusive ao alternar as abas.
    enabled: (current) =>
      active && mounted && Boolean(query) && current.state.status !== 'error',
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: Infinity,
  })
  useEffect(() => {
    if (result.error) onError(result.error)
  }, [result.error, onError])
  const busy = result.isFetching
  const disabled = !mounted || busy || seconds > 0

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const q = draft.trim()
    if (!q || disabled) return
    if (q === query && page === 1) void result.refetch()
    else onNavigate({ entidade: entity, q, page: 1 })
  }

  return (
    <section aria-labelledby="semantic-heading" className="space-y-6">
      <div>
        <h2
          id="semantic-heading"
          className="text-2xl font-semibold text-secondary"
        >
          Encontre pesquisas pelo significado
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Descreva um tema com suas palavras. Os resultados seguem a relevância
          calculada pela API e abrangem os registros que já possuem embeddings.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="semantic-query" className="text-sm font-medium">
          O que você está procurando?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="semantic-query"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            placeholder="Ex.: grupos que estudam aprendizado de máquina na saúde"
            size="lg"
          />
          <Button type="submit" size="lg" disabled={disabled || !draft.trim()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Search />}{' '}
            Buscar com IA
          </Button>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Sugestões de busca">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setDraft(example)}
              className="rounded-full border border-border-subtle px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              {example}
            </button>
          ))}
        </div>
      </form>
      <div
        className="flex flex-wrap gap-2 border-b border-border-subtle pb-4"
        aria-label="Tipo de resultado"
      >
        {semanticEntities.map((item) => (
          <Button
            key={item}
            type="button"
            variant={entity === item ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={entity === item}
            disabled={disabled}
            onClick={() => onNavigate({ entidade: item, q: query, page: 1 })}
          >
            {semanticLabels[item]}
          </Button>
        ))}
      </div>
      <AiFeedback error={result.error} seconds={seconds} />
      <div aria-live="polite" aria-busy={busy} className="space-y-4">
        {busy ? (
          <p className="flex items-center gap-2 py-10 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" /> Buscando registros
            relacionados ao tema…
          </p>
        ) : !query ? (
          <div className="rounded-xl border border-dashed border-border-subtle px-6 py-12 text-center text-muted-foreground">
            Escreva um tema e escolha o tipo de resultado para começar.
          </div>
        ) : !result.error && result.data ? (
          <>
            <p className="text-sm text-muted-foreground">
              {result.data.meta.totalItems.toLocaleString('pt-BR')} resultados ·
              por relevância
            </p>
            {!result.data.data.length && (
              <p className="rounded-xl bg-surface p-6">
                Nenhum resultado para esta consulta. Tente descrever o tema de
                outra forma. A cobertura depende dos dados já indexados.
              </p>
            )}
            <ol className="space-y-3" aria-label="Resultados semânticos">
              {result.data.data.map((item, index) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border-subtle bg-card p-5"
                >
                  <div className="flex gap-3">
                    <span className="mt-1 text-xs text-muted-foreground">
                      {(page - 1) * 10 + index + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-secondary">
                        {item.title}
                      </h3>
                      {item.details.length > 0 && (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.details.join(' · ')}
                        </p>
                      )}
                      {item.description && (
                        <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                      {item.href && (
                        <a
                          href={item.href}
                          target={item.external ? '_blank' : undefined}
                          rel={
                            item.external ? 'noopener noreferrer' : undefined
                          }
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          {entity === 'pesquisadores'
                            ? 'Ver currículo Lattes'
                            : entity === 'linhas'
                              ? 'Ver grupo da linha'
                              : 'Ver detalhes'}
                          <ArrowRight className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {result.data.meta.totalPages > 1 && (
              <nav
                aria-label="Paginação dos resultados"
                className="flex items-center justify-between gap-3 pt-4"
              >
                <Button
                  variant="outline"
                  disabled={page <= 1 || disabled}
                  onClick={() =>
                    onNavigate({ entidade: entity, q: query, page: page - 1 })
                  }
                >
                  <ChevronLeft /> Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {result.data.meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= result.data.meta.totalPages || disabled}
                  onClick={() =>
                    onNavigate({ entidade: entity, q: query, page: page + 1 })
                  }
                >
                  Próxima <ChevronRight />
                </Button>
              </nav>
            )}
          </>
        ) : null}
      </div>
    </section>
  )
}
