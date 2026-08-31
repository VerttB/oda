import React from 'react'
import { Award } from 'lucide-react'
import type { Author } from '#/core/interfaces'

interface GroupLeadersProps {
  leaders: Author[]
  onSelectLeader?: (leaderId: string) => void
}

export const GroupLeaders: React.FC<GroupLeadersProps> = ({
  leaders,
  onSelectLeader,
}) => {
  return (
    <section id="group-leaders-section" className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Award className="w-6 h-6" />
        <h2 className="text-2xl md:text-3xl font-semibold text-secondary tracking-tight">
          Líderes do Grupo
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {leaders.length > 0 ? (
          leaders.map((leader) => (
            <button
              key={leader.id}
              type="button"
              onClick={() => onSelectLeader?.(leader.id)}
              className="group flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-surface-card p-4 text-left shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-colors hover:border-primary-400"
            >
              <img
                src={leader.avatar}
                alt={leader.name}
                className="h-16 w-16 rounded-lg border border-slate-200 bg-slate-100 object-cover"
              />
              <div>
                <div className="text-lg font-semibold text-secondary transition-colors group-hover:text-primary">
                  {leader.name}
                </div>
                <div className="mt-0.5 text-xs font-semibold tracking-wider text-primary uppercase">
                  {leader.role}
                </div>
                {leader.institution && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {leader.institution}
                  </div>
                )}
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-surface-card p-6 text-sm text-muted-foreground sm:col-span-2">
            Nenhum líder informado.
          </div>
        )}
      </div>
    </section>
  )
}
