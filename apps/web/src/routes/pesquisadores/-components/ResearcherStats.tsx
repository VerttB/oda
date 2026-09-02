import type { FC } from 'react'

interface ResearcherStatsProps {
  totalIndexed?: string
  totalWithOrcid?: string
}

export const ResearcherStats: FC<ResearcherStatsProps> = ({
  totalIndexed = '0',
  totalWithOrcid = '0',
}) => {
  return (
    <header className="w-full border-b border-secondary bg-secondary py-12 pt-28 text-white md:py-16 md:pt-32">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center md:px-10">
        <div>
          <h1 className="mb-1.5 text-3xl font-bold tracking-tight text-white md:text-5xl">
            Pesquisadores
          </h1>
          <p className="text-base text-white/75 md:text-lg">
            Explore a rede de pesquisadores cadastrados na base do ODA.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3.5 shadow-sm md:p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
              Total indexado
            </div>
            <div className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {totalIndexed}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3.5 shadow-sm md:p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">
              Com ORCID
            </div>
            <div className="text-2xl font-bold tracking-tight text-accent md:text-3xl">
              {totalWithOrcid}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
