import type { FC } from 'react'

import { Button } from '#/components/ui/button'

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
              <Button
                key={institution.name}
                type="button"
                variant={isSelected ? 'outline' : 'ghost'}
                size="sm"
                onClick={() =>
                  onSelectInstitution(
                    isSelected ? 'Todas as instituições' : institution.fullName,
                  )
                }
                className={`h-auto rounded px-1.5 py-0.5 text-xs md:text-sm ${
                  isSelected
                    ? 'border border-primary/20 bg-primary-light font-bold text-primary'
                    : 'text-secondary hover:bg-transparent hover:text-primary'
                }`}
              >
                <strong className="font-semibold">{institution.name}:</strong>{' '}
                {institution.count}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
