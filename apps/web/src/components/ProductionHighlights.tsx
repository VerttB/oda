import { ArrowRight, BookOpen, Building2, CalendarDays } from 'lucide-react'

import type { GeneralMetrics } from '#/api/metricas'
import type { ProductionItem } from '#/core/interfaces'
import { Button } from './ui/button'

type ProductionHighlightsProps = {
  productions: ProductionItem[]
  metrics: GeneralMetrics
  onSelectProduction: (production: ProductionItem) => void
  onViewAll: () => void
}

const numberFormatter = new Intl.NumberFormat('pt-BR')
const percentFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
})

function CoverageItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-accent pl-3">
      <p className="text-xl font-semibold text-secondary">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function ProductionHighlights({
  productions,
  metrics,
  onSelectProduction,
  onViewAll,
}: ProductionHighlightsProps) {
  return (
    <section id="production-highlights">
      <div className="mb-5 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-primary uppercase">
            Panorama do acervo
          </p>
          <h2 className="text-2xl font-semibold tracking-normal text-secondary md:text-3xl">
            Produções para explorar
          </h2>
        </div>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onViewAll}
          className="h-auto w-fit gap-1.5 p-0 pb-0.5 text-xs tracking-wider text-primary uppercase hover:text-secondary"
        >
          Ver todas
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <div className="mb-6 grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-3">
        <CoverageItem
          label="Instituições mapeadas"
          value={numberFormatter.format(metrics.totalInstitutions)}
        />
        <CoverageItem
          label="Produções com DOI"
          value={`${percentFormatter.format(metrics.productionCoverage.doi)}%`}
        />
        <CoverageItem
          label="Produções com resumo"
          value={`${percentFormatter.format(metrics.productionCoverage.abstract)}%`}
        />
      </div>

      {productions.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {productions.map((production) => (
            <article
              key={production.id}
              className="flex min-h-52 flex-col rounded-lg border border-border bg-surface p-5 shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-colors hover:border-accent"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-surface-alt px-2.5 py-1 font-semibold text-secondary">
                  {production.type}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {production.year}
                </span>
                {production.qualis ? (
                  <span className="font-semibold text-primary">
                    Qualis {production.qualis}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onSelectProduction(production)}
                className="text-left"
              >
                <h3 className="line-clamp-3 text-lg font-semibold leading-snug text-secondary transition-colors hover:text-primary">
                  {production.title}
                </h3>
              </button>

              <div className="mt-auto space-y-2 pt-5 text-xs text-muted-foreground">
                <p className="flex items-center gap-2">
                  <BookOpen className="size-3.5 shrink-0" />
                  <span className="line-clamp-1">
                    {production.journalOrConference ?? 'Veículo não informado'}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="line-clamp-1">
                    {production.institution ?? 'Instituição não informada'}
                  </span>
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Nenhuma produção disponível no momento.
        </p>
      )}
    </section>
  )
}
