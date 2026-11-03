import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MessageSquare, Search, Sparkles } from 'lucide-react'
import { semanticEntities } from '#/api/ai'
import type { SemanticEntity } from '#/api/ai'
import { Button } from '#/components/ui/button'
import { AssistantChat } from '#/features/ai/AssistantChat'
import { SemanticSearch } from '#/features/ai/SemanticSearch'
import { useAiCooldown } from '#/features/ai/use-ai-cooldown'

type AiSearch = {
  modo: 'busca' | 'chat'
  entidade: SemanticEntity
  q: string
  page: number
}

function parseSearch(search: Record<string, unknown>): AiSearch {
  const page = Number(search.page)
  return {
    modo: search.modo === 'chat' ? 'chat' : 'busca',
    entidade: semanticEntities.includes(search.entidade as SemanticEntity)
      ? (search.entidade as SemanticEntity)
      : 'grupos',
    q: typeof search.q === 'string' ? search.q.trim().slice(0, 500) : '',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  }
}

export const Route = createFileRoute('/ia')({
  validateSearch: parseSearch,
  head: () => ({ meta: [{ title: 'Busca e assistente com IA | ODA' }] }),
  component: AiPage,
})

function AiPage() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { seconds, reportError } = useAiCooldown()
  const updateSearch = (next: Partial<AiSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...next }) })
  return (
    <main
      data-ai-ready={ready}
      className="min-h-screen bg-background pb-16 pt-36 md:pt-28"
    >
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <header className="mb-8">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="size-4" /> Explore com IA
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-secondary md:text-4xl">
            Da pergunta à pesquisa
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Encontre registros por significado ou converse com o acervo do
            observatório. As duas ferramentas utilizam os dados já indexados no
            ODA.
          </p>
        </header>
        <div
          className="mb-6 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Ferramentas de IA"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return
            event.preventDefault()
            const modo =
              event.key === 'Home'
                ? 'busca'
                : event.key === 'End'
                  ? 'chat'
                  : search.modo === 'busca'
                    ? 'chat'
                    : 'busca'
            updateSearch({ modo })
            document
              .getElementById(modo === 'busca' ? 'semantic-tab' : 'chat-tab')
              ?.focus()
          }}
        >
          <Button
            id="semantic-tab"
            disabled={!ready}
            role="tab"
            tabIndex={search.modo === 'busca' ? 0 : -1}
            aria-selected={search.modo === 'busca'}
            aria-controls="semantic-panel"
            variant={search.modo === 'busca' ? 'secondary' : 'outline'}
            onClick={() => updateSearch({ modo: 'busca' })}
          >
            <Search /> Busca semântica
          </Button>
          <Button
            id="chat-tab"
            disabled={!ready}
            role="tab"
            tabIndex={search.modo === 'chat' ? 0 : -1}
            aria-selected={search.modo === 'chat'}
            aria-controls="chat-panel"
            variant={search.modo === 'chat' ? 'secondary' : 'outline'}
            onClick={() => updateSearch({ modo: 'chat' })}
          >
            <MessageSquare /> Assistente
          </Button>
        </div>
        <p className="mb-8 rounded-lg bg-surface px-4 py-3 text-xs leading-5 text-muted-foreground">
          Visitantes têm até 2 requisições de IA por minuto, somando buscas,
          páginas de resultados e perguntas. Administradores autenticados não
          têm esse limite por enquanto. Cada consulta é enviada somente ao
          buscar, navegar pelos resultados ou enviar uma pergunta.
        </p>
        <div
          id="semantic-panel"
          role="tabpanel"
          aria-labelledby="semantic-tab"
          hidden={search.modo !== 'busca'}
        >
          <SemanticSearch
            active={search.modo === 'busca'}
            entity={search.entidade}
            query={search.q}
            page={search.page}
            seconds={seconds}
            onError={reportError}
            onNavigate={updateSearch}
          />
        </div>
        <div
          id="chat-panel"
          role="tabpanel"
          aria-labelledby="chat-tab"
          hidden={search.modo !== 'chat'}
        >
          <AssistantChat seconds={seconds} onError={reportError} />
        </div>
      </div>
    </main>
  )
}
