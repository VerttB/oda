import type { FC } from 'react'

export interface InstitutionItem {
  name: string
  count: string
  fullName: string
}

interface ProductionsTopInstitutionsBandProps {
  selectedInstitution: string
  onSelectInstitution: (institutionName: string) => void
  institutions?: InstitutionItem[]
}

export const ProductionsTopInstitutionsBand: FC<
  ProductionsTopInstitutionsBandProps
> = ({ selectedInstitution, onSelectInstitution, institutions = [] }) => {
  if (institutions.length === 0) {
    return (
      <div className="border-b border-border-subtle bg-background px-4 py-3.5 md:px-10">
        <div className="mx-auto max-w-7xl text-xs font-medium text-muted-foreground">
          Ranking de instituições será exibido quando a API de produções
          disponibilizar esse agregado.
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border-b border-border-subtle bg-background px-4 py-3.5 md:px-10">
      <div className="mx-auto flex max-w-7xl items-center space-x-6 whitespace-nowrap text-xs md:space-x-8 md:text-sm">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:text-xs">
          Top instituições:
        </span>
        <div className="flex space-x-4 md:space-x-6">
          {institutions.map((institution) => {
            const isSelected = selectedInstitution.includes(institution.name)

            return (
              <button
                key={institution.name}
                type="button"
                onClick={() =>
                  onSelectInstitution(
                    isSelected ? 'Todas as instituições' : institution.fullName,
                  )
                }
                className={`cursor-pointer rounded px-1.5 py-0.5 text-xs transition-colors md:text-sm ${
                  isSelected
                    ? 'border border-primary/20 bg-primary-light font-bold text-primary'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <strong className="font-semibold">{institution.name}:</strong>{' '}
                {institution.count}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
