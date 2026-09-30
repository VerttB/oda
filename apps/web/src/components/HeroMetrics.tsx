import { FileText, Network, Users } from 'lucide-react'

import type { GeneralMetrics } from '#/api/metricas'

type MetricCardProps = {
  icon: React.ReactNode
  value: number
  label: string
  id: string
}

const numberFormatter = new Intl.NumberFormat('pt-BR')

function MetricCard({ icon, value, label, id }: MetricCardProps) {
  return (
    <div
      id={id}
      className="relative flex flex-1 flex-col items-center rounded-lg border-b-2 border-border bg-transparent p-6 pb-2 shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-transform duration-200 before:absolute before:bottom-0 before:left-2 before:h-1/8 before:w-0.5 before:rounded-md before:bg-border after:absolute after:right-2 after:bottom-0 after:h-1/8 after:w-0.5 after:rounded-md after:bg-border hover:-translate-y-1"
    >
      <div className="mb-3 text-3xl text-accent">{icon}</div>
      <div className="text-4xl font-bold tracking-normal text-accent md:text-5xl">
        {numberFormatter.format(value)}
      </div>
      <div className="mt-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  )
}

export function HeroMetrics({ metrics }: { metrics: GeneralMetrics }) {
  return (
    <section
      id="hero-gateway"
      className="bg-secondary px-4 pt-28 pb-16 text-center text-white md:px-10"
    >
      <div className="mx-auto max-w-[1280px]">
        <h1 className="mx-auto mb-4 max-w-4xl text-3xl font-semibold tracking-normal text-white md:text-5xl">
          Acesso integrado ao Lattes e DGP
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed font-normal text-slate-300 md:text-lg">
          Explore dados integrados de pesquisadores, grupos e produção acadêmica
          brasileira em um único ambiente.
        </p>

        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
          <MetricCard
            id="metric-curricula"
            icon={<Users className="size-8" />}
            value={metrics.totalResearchers}
            label="Pesquisadores"
          />
          <MetricCard
            id="metric-groups"
            icon={<Network className="size-8" />}
            value={metrics.totalResearchGroups}
            label="Grupos de pesquisa"
          />
          <MetricCard
            id="metric-publications"
            icon={<FileText className="size-8" />}
            value={metrics.totalProductions}
            label="Produções acadêmicas"
          />
        </div>
      </div>
    </section>
  )
}
