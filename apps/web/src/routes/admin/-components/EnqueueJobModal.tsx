import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import {
  adminQueueQueryKey,
  enqueueAdminJob,
  type AdminQueue,
} from '#/api/admin'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

const IDENTIFIER_LABELS: Record<AdminQueue['id'], string> = {
  dgp: 'ID DGP',
  lattes: 'ID Lattes',
  discovery: 'Chave de descoberta',
  'etl-groups': 'ID DGP',
  'etl-researchers': 'ID Lattes',
}

type EnqueueJobModalProps = {
  queue: AdminQueue | null
  onClose: () => void
  onSuccess?: (message: string) => void
}

export function EnqueueJobModal({
  queue,
  onClose,
  onSuccess,
}: EnqueueJobModalProps) {
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState('')

  useEffect(() => setIdentifier(''), [queue])

  const mutation = useMutation({
    mutationFn: () =>
      queue ? enqueueAdminJob(queue.id, identifier) : Promise.resolve(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueueQueryKey })
      onSuccess?.(`Requisição adicionada à fila ${queue?.label ?? ''}.`)
      onClose()
    },
  })

  if (!queue) return null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enqueue-job-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg border border-border-subtle bg-background shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 id="enqueue-job-title" className="font-semibold text-primary">
              Adicionar à fila
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{queue.label}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Fechar"
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="space-y-4 p-5">
          <label className="block text-sm font-medium text-foreground">
            {IDENTIFIER_LABELS[queue.id]}
            <Input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Opcional"
              className="mt-1.5"
              autoFocus
            />
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Deixe o identificador vazio para solicitar o processamento padrão da
            fila.
          </p>
          {mutation.error ? (
            <p className="rounded-md bg-destructive/5 p-3 text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Não foi possível adicionar a requisição.'}
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-3 border-t border-border-subtle px-5 py-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            <Plus className="size-4" />
            {mutation.isPending ? 'Adicionando...' : 'Adicionar à fila'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
