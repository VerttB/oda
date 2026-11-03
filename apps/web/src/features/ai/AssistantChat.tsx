import { useEffect, useRef, useState } from 'react'
import type { LangchainResponse } from '@oda/shared-types'
import { LoaderCircle, MessageSquare, Send, Square, Trash2 } from 'lucide-react'
import { Streamdown } from 'streamdown'
import { askAssistant } from '#/api/ai'
import { Button } from '#/components/ui/button'
import { AiFeedback } from './AiFeedback'
import { AssistantSources } from './AssistantSources'

type Turn = { id: number; prompt: string; response: LangchainResponse }
type Props = { seconds: number; onError: (error: unknown) => void }
const suggestions = [
  'Quais são as linhas de pesquisa do ACSO?',
  'O que o G2BC pesquisa?',
  'Quais grupos pesquisam inteligência artificial aplicada à saúde?',
]

// Limita o contexto enviado, sem guardar a conversa no navegador ou acrescentar fontes inventadas.
function chatHistory(turns: Turn[]) {
  return turns
    .slice(-3)
    .map(
      (turn) => `Usuário: ${turn.prompt}\nAssistente: ${turn.response.output}`,
    )
    .join('\n\n')
    .slice(-12_000)
}

export function AssistantChat({ seconds, onError }: Props) {
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const request = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const busy = pending !== null

  useEffect(
    () => () => {
      request.current?.abort()
      request.current = null
    },
    [],
  )
  useEffect(() => {
    if (turns.length || pending)
      end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns.length, pending])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const prompt = draft.trim()
    if (!prompt || request.current || seconds > 0) return
    const controller = new AbortController()
    request.current = controller
    setPending(prompt)
    setError(null)
    setNotice('')
    try {
      const history = chatHistory(turns)
      const response = await askAssistant(
        { prompt, ...(history ? { chatHistory: history } : {}) },
        controller.signal,
      )
      if (controller.signal.aborted || request.current !== controller) return
      setTurns((previous) =>
        [...previous, { id: Date.now(), prompt, response }].slice(-20),
      )
      setDraft('')
    } catch (failure) {
      if (request.current !== controller) return
      if (controller.signal.aborted)
        setNotice(
          'Espera cancelada. A API pode continuar processando a pergunta e contabilizar a requisição.',
        )
      else {
        setError(failure)
        onError(failure)
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setPending(null)
      }
    }
  }

  return (
    <section aria-labelledby="assistant-heading" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="assistant-heading"
            className="text-2xl font-semibold text-secondary"
          >
            Converse com os dados do ODA
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pergunte sobre os registros indexados. Confira as fontes antes de
            utilizar a resposta: a IA pode interpretar informações de forma
            incorreta.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !turns.length}
          onClick={() => {
            setTurns([])
            setDraft('')
            setError(null)
            setNotice('Conversa limpa nesta página.')
            input.current?.focus()
          }}
        >
          <Trash2 /> Limpar conversa
        </Button>
      </div>
      <div
        className="max-h-[620px] min-h-48 space-y-6 overflow-y-auto rounded-xl border border-border-subtle bg-surface/40 p-4 sm:p-6"
        role="log"
        aria-label="Conversa com o assistente"
      >
        {!turns.length && !busy && (
          <div className="py-6 text-center">
            <MessageSquare className="mx-auto mb-4 size-8 text-primary" />
            <h3 className="font-semibold text-secondary">
              Comece com uma pergunta
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              O assistente consulta o acervo disponível. Uma ausência de
              resultados não significa que a pesquisa não exista.
            </p>
            <div className="mx-auto mt-5 flex max-w-2xl flex-col gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-lg border border-border-subtle bg-background px-4 py-3 text-left text-sm hover:border-primary"
                  onClick={() => {
                    setDraft(suggestion)
                    input.current?.focus()
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-4">
            <div className="ml-auto max-w-[90%] rounded-xl bg-secondary px-5 py-4 text-white">
              <p className="mb-1 text-xs font-semibold opacity-70">Você</p>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {turn.prompt}
              </p>
            </div>
            <article
              className="rounded-xl border border-border-subtle bg-background p-5"
              aria-label="Resposta do assistente"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
                Assistente ODA
              </p>
              <Streamdown
                mode="static"
                skipHtml
                controls={false}
                disallowedElements={['img', 'iframe', 'video', 'audio']}
                className="space-y-3 text-sm leading-7 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc"
                components={{
                  a: ({ href, children }) =>
                    href && /^https?:\/\//i.test(href) ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {children}
                      </a>
                    ) : (
                      <span>{children}</span>
                    ),
                }}
              >
                {turn.response.output}
              </Streamdown>
              {turn.response.grounded === false && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                  A revisão automática não confirmou apoio suficiente nas
                  fontes. Verifique os registros consultados.
                </p>
              )}
              {turn.response.sources?.length ? (
                <AssistantSources sources={turn.response.sources} />
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  A API não retornou fontes para esta resposta.
                </p>
              )}
            </article>
          </div>
        ))}
        {busy && (
          <div className="space-y-4">
            <div className="ml-auto max-w-[90%] rounded-xl bg-secondary px-5 py-4 text-sm leading-6 text-white">
              <p className="mb-1 text-xs font-semibold opacity-70">Você</p>
              {pending}
            </div>
            <p
              role="status"
              className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-5 animate-spin" /> Consultando os
              dados e preparando a resposta…
            </p>
          </div>
        )}
        <div ref={end} />
      </div>
      <AiFeedback error={error} seconds={seconds} />
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="assistant-prompt" className="text-sm font-medium">
          Sua pergunta
        </label>
        <textarea
          ref={input}
          id="assistant-prompt"
          rows={3}
          maxLength={2000}
          value={draft}
          readOnly={busy}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex.: quais temas o NPAI estuda?"
          className="w-full resize-y rounded-xl border border-border-subtle bg-background p-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {draft.length}/2.000 · Conversa mantida apenas nesta página.
          </p>
          {busy ? (
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                // O mesmo botão volta a ser submit após a atualização de estado.
                event.preventDefault()
                request.current?.abort()
                request.current = null
                setPending(null)
                setNotice(
                  'Espera cancelada. A API pode continuar processando a pergunta e contabilizar a requisição.',
                )
              }}
            >
              <Square /> Cancelar espera
            </Button>
          ) : (
            <Button type="submit" disabled={!draft.trim() || seconds > 0}>
              <Send /> Enviar pergunta
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
