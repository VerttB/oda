import { FileText } from 'lucide-react'
import type { FC } from 'react'

interface ProductionStatsProps {
  totalCount?: string
}

export const ProductionStats: FC<ProductionStatsProps> = ({
  totalCount = '0',
}) => {
  return (
    <section className="w-full bg-secondary px-4 pb-10 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-5xl">
          Produções
        </h1>
        <p className="mb-6 max-w-2xl text-base text-white/75 md:text-lg">
          Explore a produção científica cadastrada na base do ODA.
        </p>

        <div className="inline-flex items-center space-x-3 rounded-lg border border-white/10 bg-white/5 px-6 py-3.5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Total de produções
            </div>
            <div className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              {totalCount}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
