import { Building2, MapPinned } from 'lucide-react'
import type { FC } from 'react'

import type { ResearchGroupsDirectoryMetrics } from '#/api/grupos-pesquisa'
import { Button } from '#/components/ui/button'

interface DirectoryTopUniversitiesBandProps {
  onSelectUniversity: (uf: string) => void
  institutions?: ResearchGroupsDirectoryMetrics['topInstitutions']
  ufs?: ResearchGroupsDirectoryMetrics['topUfs']
}

export const DirectoryTopUniversitiesBand: FC<
  DirectoryTopUniversitiesBandProps
> = ({ onSelectUniversity, institutions = [], ufs = [] }) => {
  if (institutions.length === 0 && ufs.length === 0) {
    return null
  }

  return (
    <section className="mb-10 grid gap-8 border-b border-border-subtle pb-8 lg:grid-cols-[0.8fr_1.2fr]">
      {ufs.length > 0 && (
        <div>
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-primary md:text-xl">
            <MapPinned className="h-5 w-5 text-accent" />
            <span>UFs com mais grupos</span>
          </h2>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {ufs.map((item) => (
              <Button
                key={item.uf}
                type="button"
                variant="ghost"
                onClick={() => onSelectUniversity(item.uf)}
                className="group h-auto items-baseline justify-start gap-3 p-0 text-left hover:bg-transparent"
                title={`Filtrar grupos da UF ${item.uf}`}
              >
                <span className="text-xl font-bold text-primary transition-colors group-hover:text-primary-hover">
                  {item.uf}
                </span>
                <span className="text-sm text-secondary">
                  {item.count.toLocaleString('pt-BR')} grupos
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {institutions.length > 0 && (
        <div>
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-primary md:text-xl">
            <Building2 className="h-5 w-5 text-accent" />
            <span>Instituições com mais grupos</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {institutions.map((institution) => (
              <Button
                key={institution.id}
                type="button"
                variant="outline"
                onClick={() => onSelectUniversity(institution.uf ?? '')}
                className="h-auto flex-col items-stretch justify-start rounded-lg border-border-subtle bg-background p-3 text-left hover:border-primary/40 hover:bg-surface"
                title={
                  institution.uf
                    ? `Filtrar grupos da UF ${institution.uf}`
                    : undefined
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-primary">
                    {institution.name}
                  </span>
                  {institution.uf && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {institution.uf}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-secondary">
                  {institution.count.toLocaleString('pt-BR')} grupos
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {institution.hostCount.toLocaleString('pt-BR')} sede ·{' '}
                  {institution.partnerCount.toLocaleString('pt-BR')} parceira
                </p>
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
