import React from 'react'
import { Compass, CheckCircle2 } from 'lucide-react'
import type { ResearchLine } from '#/core/interfaces'

interface ResearchLinesProps {
  researchLines: ResearchLine[]
}

export const ResearchLines: React.FC<ResearchLinesProps> = ({
  researchLines,
}) => {
  return (
    <section id="research-lines-section" className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Compass className="w-6 h-6" />
        <h2 className="text-2xl md:text-3xl font-semibold text-secondary tracking-tight">
          Linhas de Pesquisa e Setores de Aplicação
        </h2>
      </div>

      <div className="space-y-6">
        {researchLines.length > 0 ? (
          researchLines.map((line) => (
            <div
              key={line.title}
              className="rounded-lg border-2 border-dashed border-primary-400/50 bg-surface-card p-6 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-colors hover:border-primary-400"
            >
              <div className="flex flex-col items-start justify-between gap-6 lg:flex-row">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-secondary md:text-2xl">
                      {line.title}
                    </h3>
                    {line.isMainFocus && (
                      <span className="rounded border border-border bg-primary-50 px-2.5 py-1 text-xs font-semibold tracking-wider text-primary uppercase">
                        Foco Principal
                      </span>
                    )}
                  </div>

                  <div className="mb-3 text-xs font-semibold tracking-wider text-primary uppercase">
                    Área: {line.area}
                  </div>

                  <p className="mb-6 text-sm leading-relaxed text-muted-foreground md:text-base">
                    {line.description}
                  </p>

                  {line.keywords.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Palavras-chave:
                      </span>
                      {line.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {line.applicationSectors.length > 0 && (
                  <div className="w-full shrink-0 rounded-lg border-2 border-dotted border-accent/50 bg-surface p-4 lg:w-[320px]">
                    <div className="mb-3 text-xs font-semibold tracking-wider text-primary uppercase">
                      Setores de Aplicação
                    </div>
                    <ul className="space-y-2 text-sm text-foreground">
                      {line.applicationSectors.map((sector) => (
                        <li key={sector} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-accent" />
                          <span>{sector}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-surface-card p-6 text-sm text-muted-foreground">
            Nenhuma linha de pesquisa informada.
          </div>
        )}
      </div>
    </section>
  )
}
