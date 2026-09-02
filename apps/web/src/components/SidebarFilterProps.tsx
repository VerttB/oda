import React from 'react'
import type { FilterState } from '../core/interfaces'

interface SidebarFiltersProps {
  filters: FilterState
  onFilterChange: (newFilters: FilterState) => void
}

const FIELD_OPTIONS = [
  'Ciência da Computação',
  'Biologia',
  'Física',
  'Medicina',
]

const DATE_OPTIONS = [
  'Qualquer momento',
  'Último ano',
  'Últimos 5 anos',
  'Últimos 10 anos',
]

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const toggleField = (field: string) => {
    const exists = filters.fieldsOfStudy.includes(field)
    const updated = exists
      ? filters.fieldsOfStudy.filter((f) => f !== field)
      : [...filters.fieldsOfStudy, field]

    onFilterChange({
      ...filters,
      fieldsOfStudy: updated,
    })
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      publicationDate: e.target.value,
    })
  }

  return (
    <aside id="sidebar-filters" className="space-y-6">
      <div className="bg-surface border border-border p-6 shadow-[0_4px_12px_rgba(15,23,42,0.05)] rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-secondary">Filtros</h3>
          {(filters.fieldsOfStudy.length > 0 ||
            filters.publicationDate !== 'Qualquer momento') && (
            <button
              onClick={() =>
                onFilterChange({
                  ...filters,
                  fieldsOfStudy: [],
                  publicationDate: 'Qualquer momento',
                })
              }
              className="text-xs text-primary hover:underline font-medium cursor-pointer"
            >
              Resetar
            </button>
          )}
        </div>

        {/* Campo de estudo */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Campo de Estudo
          </h4>
          <div className="space-y-2">
            {FIELD_OPTIONS.map((field) => {
              const isChecked = filters.fieldsOfStudy.includes(field)
              return (
                <label
                  key={field}
                  className="flex items-center gap-2.5 cursor-pointer text-foreground text-sm hover:text-secondary select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleField(field)}
                    className="rounded border-slate-300 text-accent focus:ring-accent h-4 w-4 cursor-pointer accent-accent"
                  />
                  <span>{field}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Data de publicação */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Data de Publicação
          </h4>
          <select
            value={filters.publicationDate}
            onChange={handleDateChange}
            className="w-full bg-surface-alt border border-border rounded-md text-sm text-foreground p-2 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-hidden cursor-pointer"
          >
            {DATE_OPTIONS.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </div>
      </div>
    </aside>
  )
}
