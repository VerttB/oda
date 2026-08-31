import type { FC } from 'react'

interface GroupMainPageStatsProps {
  totalCount?: string
}

export const GroupMainPageStats: FC<GroupMainPageStatsProps> = ({
  totalCount = '0',
}) => {
  return (
    <section className="relative w-full overflow-hidden bg-secondary px-4 pb-10 pt-28 text-white md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="max-w-3xl">
          <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-5xl">
            Diretório de Grupos de Pesquisa
          </h1>
          <p className="text-sm leading-relaxed text-white/75 md:text-base">
            Explore os grupos cadastrados, suas instituições, áreas de
            conhecimento, lideranças e linhas de pesquisa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6 border-t border-white/15 pt-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/65">
            Status da base
          </span>
          <div className="flex items-baseline gap-2 text-2xl font-bold text-accent">
            {totalCount}{' '}
            <span className="text-xs font-normal text-white/65">
              grupos carregados
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
