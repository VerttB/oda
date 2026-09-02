import React from 'react'
import { Building2, Landmark, ShieldCheck } from 'lucide-react'

interface InstitutionalAffiliationProps {
  hostInstitution: {
    name: string
    code: string
  }
  partnerInstitutions: {
    name: string
    code: string
  }[]
}

export const InstitutionalAffiliation: React.FC<
  InstitutionalAffiliationProps
> = ({ hostInstitution, partnerInstitutions }) => {
  return (
    <section id="institutional-affiliation" className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Landmark className="w-6 h-6" />
        <h2 className="text-2xl md:text-3xl font-semibold text-secondary tracking-tight">
          Vínculo Institucional
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="col-span-1 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dotted border-primary-400/50 bg-surface-card p-6 text-center shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-colors hover:border-primary-400">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-surface-alt text-secondary">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold tracking-wider text-primary uppercase">
              Instituição Sede
            </div>
            <div className="text-lg md:text-xl font-semibold text-secondary">
              {hostInstitution.name}
            </div>
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">
              Sigla: {hostInstitution.code}
            </div>
          </div>
        </div>

        <div className="col-span-1 flex flex-col justify-between rounded-lg border-2 border-dotted border-accent/50 bg-surface-card p-6 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-colors hover:border-accent md:col-span-2">
          <div className="mb-4 text-xs font-semibold tracking-wider text-primary uppercase">
            Instituições Parceiras e Agências de Fomento
          </div>

          {partnerInstitutions.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {partnerInstitutions.map((partner) => (
                <div
                  key={`${partner.code}-${partner.name}`}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface-alt p-3 transition-colors hover:bg-slate-100"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-white text-secondary">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-center text-sm font-semibold text-foreground">
                    {partner.name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma instituição parceira informada.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
