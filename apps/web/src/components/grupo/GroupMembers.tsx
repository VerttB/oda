import React from 'react'
import { Users } from 'lucide-react'
import type { Author } from '#/core/interfaces'

interface GroupMembersProps {
  members: Author[]
}

export const GroupMembers: React.FC<GroupMembersProps> = ({ members }) => {
  return (
    <section id="group-members-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Users className="w-6 h-6" />
          <h2 className="text-2xl md:text-3xl font-semibold text-secondary tracking-tight">
            Membros
          </h2>
        </div>
        {members.length > 0 && (
          <button
            type="button"
            className="cursor-pointer text-xs font-semibold tracking-wider text-primary uppercase hover:underline"
          >
            Ver todos
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {members.length > 0 ? (
          members.map((member) => (
            <div
              key={member.id}
              className="group flex cursor-pointer items-center gap-3.5 rounded-lg border border-border bg-surface-card p-3.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-colors hover:border-primary-400"
            >
              <img
                src={member.avatar}
                alt={member.name}
                className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-secondary transition-colors group-hover:text-primary">
                  {member.name}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-semibold tracking-wider text-primary uppercase">
                  {member.role}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-surface-card p-6 text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
            Nenhum membro informado.
          </div>
        )}
      </div>
    </section>
  )
}
