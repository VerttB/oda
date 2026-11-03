import { AlertCircle } from 'lucide-react'

export function AiFeedback({
  error,
  seconds,
}: {
  error?: unknown
  seconds: number
}) {
  if (!error && !seconds) return null
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p>
          {seconds > 0
            ? 'Limite de uso de IA atingido.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível concluir a consulta.'}
        </p>
        {seconds > 0 && (
          <p className="mt-1" aria-live="off">
            Tente novamente em {seconds} s. Busca e assistente compartilham o
            limite.
          </p>
        )}
      </div>
    </div>
  )
}
