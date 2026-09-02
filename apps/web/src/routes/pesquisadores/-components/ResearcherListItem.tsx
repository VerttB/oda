import type { ResearcherItem } from '#/core/interfaces'
import { ChevronRight, Landmark } from 'lucide-react'
import type { FC } from 'react'

interface ResearcherListItemProps {
  researcher: ResearcherItem
  onSelect: (researcher: ResearcherItem) => void
}

export const ResearcherListItem: FC<ResearcherListItemProps> = ({
  researcher,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(researcher)}
      className="group flex cursor-pointer flex-col items-start justify-between gap-4 p-4 text-left transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:p-5"
    >
      <div className="flex min-w-0 flex-grow items-start gap-4">
        {researcher.avatar ? (
          <img
            src={researcher.avatar}
            alt={researcher.name}
            className="h-12 w-12 flex-shrink-0 rounded-full border border-border-subtle object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-base font-bold text-secondary">
            {researcher.initials || researcher.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <h4 className="truncate text-base font-bold text-primary transition-colors group-hover:text-primary-hover">
            {researcher.name}
          </h4>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-secondary">
            <span className="flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5 shrink-0 text-secondary" />
              <span>{researcher.institution}</span>
            </span>
            <span>•</span>
            <span>{researcher.degree || 'Formação não informada'}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {researcher.title && (
              <span className="rounded bg-primary-light px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary">
                {researcher.title}
              </span>
            )}
            <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-wide text-secondary">
              {researcher.isActive !== false ? 'Ativo' : 'Inativo'}
            </span>
            {researcher.hIndex > 0 && (
              <span className="hidden text-[11px] font-medium text-secondary sm:inline">
                h-index {researcher.hIndex}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end self-end text-right sm:self-center">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">
          Produções i10
        </span>
        <span className="text-xs font-semibold text-foreground sm:text-sm">
          {researcher.productionsCount ?? 0}
        </span>
        <span className="mt-2 text-primary transition-colors hover:text-primary-hover">
          <ChevronRight className="h-5 w-5" />
        </span>
      </div>
    </button>
  )
}
