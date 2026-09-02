import React from 'react'
import { Users, FileText, FlaskConical, Calendar, MapPin } from 'lucide-react'
import type { ResearchGroupDetail } from '#/core/interfaces'

interface GroupHeroProps {
  group: ResearchGroupDetail
}

export const GroupHero: React.FC<GroupHeroProps> = ({ group }) => {
  const formationYear =
    group.stats.formationYear > 0 ? group.stats.formationYear : 'Não informado'

  return (
    <section
      id="group-hero"
      className="bg-secondary px-4 pt-28 pb-12 text-white md:px-10"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-8 md:flex-row md:items-center">
        <div className="flex-1 space-y-5">
          <div className="mb-1 flex flex-wrap gap-2.5">
            <span className="inline-block rounded border border-primary-300/30 bg-primary-300/15 px-3 py-1 text-xs font-semibold tracking-wider text-primary-200 uppercase">
              {group.secondaryTag}
            </span>
            <span className="inline-block rounded border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-semibold tracking-wider text-accent uppercase">
              Principal Área: {group.primaryArea}
            </span>
          </div>

          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-white md:text-5xl">
            {group.name}
          </h1>

          <p className="max-w-2xl text-base leading-relaxed font-normal text-slate-300 md:text-lg">
            {group.description}
          </p>

          <div className="flex flex-wrap gap-6 border-t border-slate-700/60 pt-4 md:gap-8">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-accent" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {group.stats.members}
                </div>
                <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Membros
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-primary-200" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {group.stats.publications}
                </div>
                <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Publicações
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <FlaskConical className="w-5 h-5 text-primary-200" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {group.stats.projects}
                </div>
                <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Linhas
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-accent" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {formationYear}
                </div>
                <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Ano de Formação
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-primary-200" />
              <div>
                <div className="text-2xl font-bold text-white">
                  {group.stats.location}
                </div>
                <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Localização
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative h-[260px] w-full shrink-0 overflow-hidden rounded-lg border border-primary-300/30 bg-surface-dark shadow-2xl md:h-[300px] md:w-[360px] lg:w-[420px]">
          {group.coverImage ? (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-85 transition-transform duration-700 hover:scale-105"
              style={{ backgroundImage: `url("${group.coverImage}")` }}
            />
          ) : (
            <div className="absolute inset-0 bg-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-secondary via-transparent to-transparent opacity-60" />
          <div className="absolute bottom-3 left-3 rounded border border-primary-300/20 bg-secondary/80 px-2.5 py-1 font-mono text-[11px] text-primary-200 backdrop-blur-xs">
            {group.id}
          </div>
        </div>
      </div>
    </section>
  )
}
