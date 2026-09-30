import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertCircle, Clock3, Plus, RefreshCw, Server } from 'lucide-react'

import {
  adminQueueQueryKey,
  getAdminQueueSnapshot,
  type AdminActiveJob,
  type AdminQueue,
} from '#/api/admin'
import { Button } from '#/components/ui/button'
import { EnqueueJobModal } from './EnqueueJobModal'

const STATE_LABELS: Record<string, string> = {
  active: 'Ativo',
  waiting: 'Aguardando',
  delayed: 'Agendado',
  completed: 'Concluído',
  failed: 'Falhou',
  paused: 'Pausado',
}

function formatState(state: string) {
  return STATE_LABELS[state.toLowerCase()] ?? state
}

function formatDate(value?: string | null) {
  if (!value) return 'Não informado'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(date)
}

function getJobTitle(job: AdminActiveJob) {
  return (
    job.nome ??
    job.lattesId ??
    job.dgpId ??
    job.chave ??
    job.jobId ??
    'Job sem identificação'
  )
}

function JobItem({ job }: { job: AdminActiveJob }) {
  const progress = Math.min(100, Math.max(0, job.progresso?.percentual ?? 0))
  const attempt = job.tentativaAtual ?? 0
  const maxAttempts = job.tentativasMaximas ?? 0

  return (
    <article className="border-t border-border-subtle py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">
            {getJobTitle(job)}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {job.jobId}
          </p>
        </div>
        <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          {formatState(job.estado)}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-secondary">
            {job.progresso?.etapa?.replaceAll('_', ' ') ?? 'Processando'}
          </span>
          <span className="font-semibold text-primary">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {job.progresso?.paginasTotal ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Página {job.progresso.paginaAtual ?? 0} de{' '}
            {job.progresso.paginasTotal}
          </p>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Worker</dt>
          <dd className="mt-0.5 break-all font-medium text-foreground">
            {job.worker ?? 'Aguardando worker'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tentativa</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {maxAttempts
              ? `${attempt} de ${maxAttempts}`
              : attempt || 'Não informada'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="flex items-center gap-1 text-muted-foreground">
            <Clock3 className="size-3" /> Iniciado em
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {formatDate(job.iniciadoEm)}
          </dd>
        </div>
      </dl>

      {job.ultimoErro ? (
        <p className="mt-4 flex gap-2 rounded-md bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{job.ultimoErro}</span>
        </p>
      ) : null}
    </article>
  )
}

function QueueCard({
  queue,
  onEnqueue,
}: {
  queue: AdminQueue
  onEnqueue: (queue: AdminQueue) => void
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-background p-5 shadow-xs">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-primary">{queue.label}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {queue.total} job{queue.total === 1 ? '' : 's'} em processamento
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => onEnqueue(queue)}
        >
          <Plus className="size-3.5" />
          Adicionar
        </Button>
      </div>

      {queue.jobs.length ? (
        <div>
          {queue.jobs.map((job) => (
            <JobItem key={job.jobId} job={job} />
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-surface px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum job ativo.
        </p>
      )}
    </section>
  )
}

export function AdminQueuesView({
  onToast,
}: {
  onToast?: (message: string) => void
}) {
  const [selectedQueue, setSelectedQueue] = useState<AdminQueue | null>(null)
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: adminQueueQueryKey,
    queryFn: getAdminQueueSnapshot,
    refetchInterval: 15_000,
  })

  return (
    <div className="min-h-full bg-surface">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Operação do pipeline
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-primary">
              Filas e workers
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Acompanhamento em tempo real, atualizado a cada 15 segundos.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={isFetching ? 'size-4 animate-spin' : 'size-4'}
            />
            Atualizar
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : 'Não foi possível carregar as filas.'}
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-border-subtle bg-background p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <Server className="size-5 text-secondary" />
                <h2 className="font-semibold text-primary">
                  Workers conectados
                </h2>
              </div>
              <p className="mt-3 text-3xl font-semibold text-primary">
                {data?.workers.length ?? 0}
              </p>
            </section>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {(data?.queues ?? []).map((queue) => (
                <QueueCard
                  key={queue.id}
                  queue={queue}
                  onEnqueue={setSelectedQueue}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <EnqueueJobModal
        queue={selectedQueue}
        onClose={() => setSelectedQueue(null)}
        onSuccess={onToast}
      />
    </div>
  )
}
