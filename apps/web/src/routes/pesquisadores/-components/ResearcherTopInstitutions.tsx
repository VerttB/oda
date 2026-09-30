import type { ResearchersMetrics } from '#/api/pesquisadores'
import type { FC } from 'react'

interface ResearchersTopInstitutionsBandProps {
  metrics?: ResearchersMetrics
}

export const ResearchersTopInstitutionsBand: FC<
  ResearchersTopInstitutionsBandProps
> = ({ metrics }) => {
  if (!metrics) {
    return null
  }

  return (
    <section className="w-full overflow-x-auto border-b border-border-subtle bg-background px-4 py-3 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs md:flex-row md:items-center md:gap-10 md:text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary md:text-xs">
            Por formação:
          </span>
          {metrics.byDegree.slice(0, 5).map((item) => (
            <span
              key={item.degree}
              className="rounded bg-surface px-2 py-1 font-medium text-secondary"
            >
              {item.label}: {item.count.toLocaleString('pt-BR')}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary md:text-xs">
            Por tipo:
          </span>
          {metrics.byType.slice(0, 5).map((item) => (
            <span
              key={item.type}
              className="rounded bg-primary-light px-2 py-1 font-medium text-primary"
            >
              {item.label}: {item.count.toLocaleString('pt-BR')}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
