import {
  ArrowRight,
  Building2,
  CalendarDays,
  MapPin,
  Microscope,
} from 'lucide-react'

import type { DirectoryGroupItem } from '#/core/interfaces'
import { Button } from './ui/button'

type ResearchGroupCardsProps = {
  groups: DirectoryGroupItem[]
  onSelectGroup: (groupId: string) => void
  onExploreAllGroups: () => void
}

export function ResearchGroupCards({
  groups,
  onSelectGroup,
  onExploreAllGroups,
}: ResearchGroupCardsProps) {
  return (
    <section id="research-groups-to-explore">
      <div className="mb-5 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-primary uppercase">
            Diretório de pesquisa
          </p>
          <h2 className="text-2xl font-semibold tracking-normal text-secondary md:text-3xl">
            Grupos para explorar
          </h2>
        </div>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onExploreAllGroups}
          className="h-auto w-fit gap-1.5 p-0 pb-0.5 text-xs tracking-wider text-primary uppercase hover:text-secondary"
        >
          Explorar grupos
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {groups.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <button
              type="button"
              key={group.id}
              id={`group-summary-card-${group.id}`}
              onClick={() => onSelectGroup(group.id)}
              className="group flex min-h-64 flex-col rounded-lg border border-border bg-surface p-5 text-left shadow-[0_4px_12px_rgba(15,23,42,0.05)] transition-all hover:border-accent hover:bg-surface-alt"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-md border border-border bg-background text-secondary transition-colors group-hover:text-primary">
                <Microscope className="size-5" />
              </div>
              <p className="mb-2 text-xs font-semibold tracking-wider text-primary uppercase">
                {group.knowledgeArea}
              </p>
              <h3 className="line-clamp-3 text-lg font-semibold leading-snug text-secondary transition-colors group-hover:text-primary">
                {group.name}
              </h3>

              <div className="mt-auto space-y-2 pt-5 text-xs text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="line-clamp-1">{group.institution}</span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {group.uf}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    Desde {group.since}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Nenhum grupo disponível no momento.
        </p>
      )}
    </section>
  )
}
