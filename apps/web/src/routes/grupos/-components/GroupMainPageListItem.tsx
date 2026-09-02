import { ArrowRight, Building2 } from 'lucide-react'
import type { FC } from 'react'

import type { DirectoryGroupItem } from '#/core/interfaces'

interface GroupMainPageListItemProps {
  group: DirectoryGroupItem
  onSelect: (group: DirectoryGroupItem) => void
}

export const GroupMainPageListItem: FC<GroupMainPageListItemProps> = ({
  group,
  onSelect,
}) => {
  return (
    <article className="-mx-2 flex flex-col gap-4 rounded-lg px-2 py-5 transition-colors hover:bg-surface/60 md:flex-row md:gap-8">
      <div className="flex flex-1 flex-col">
        <button
          type="button"
          onClick={() => onSelect(group)}
          className="mb-1 cursor-pointer text-left text-base font-semibold text-primary transition-colors hover:text-primary-hover"
        >
          {group.name}
        </button>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs text-secondary">
          <Building2 className="h-3.5 w-3.5" />
          <span>{group.institution}</span>
          {group.leaders && group.leaders.length > 0 && (
            <span className="hidden text-secondary/70 sm:inline">
              • Líder: {group.leaders[0]}
            </span>
          )}
        </div>

        {group.description && (
          <p className="mb-3 line-clamp-2 text-xs text-secondary/80">
            {group.description}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <span className="rounded bg-surface px-2.5 py-0.5 text-[11px] font-medium text-secondary">
            {group.knowledgeArea}
          </span>
          <span
            className={`rounded border px-2.5 py-0.5 text-[11px] font-medium ${
              group.status === 'Active'
                ? 'border-accent/30 bg-accent-light text-accent-dark'
                : 'border-border-subtle bg-surface/50 text-secondary'
            }`}
          >
            {group.status === 'Active' ? 'Ativo' : 'Arquivado'}
          </span>
          {typeof group.membersCount === 'number' && group.membersCount > 0 && (
            <span className="text-[11px] text-secondary/70">
              {group.membersCount} pesquisadores
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col justify-between gap-3 md:w-48 md:items-end">
        <div className="flex items-center gap-1.5 text-xs text-secondary">
          <span className="font-semibold">{group.uf}</span>
          <span className="text-border-subtle">•</span>
          <span className="whitespace-nowrap">Desde {group.since}</span>
        </div>

        <button
          type="button"
          onClick={() => onSelect(group)}
          className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover hover:underline"
        >
          <span>Ver detalhes</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  )
}
