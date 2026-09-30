import type { SortOption, SortOrder } from '#/api/sorting'

type SortControlsProps<TField extends string> = {
  field: TField
  fields: SortOption<TField>[]
  order: SortOrder
  onFieldChange: (field: TField) => void
  onOrderChange: (order: SortOrder) => void
}

export function SortControls<TField extends string>({
  field,
  fields,
  order,
  onFieldChange,
  onOrderChange,
}: SortControlsProps<TField>) {
  return (
    <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <legend className="mb-2 text-xs font-semibold text-primary">
        Ordenação
      </legend>
      <label className="text-xs font-semibold text-primary">
        Ordenar por
        <select
          value={field}
          onChange={(event) => onFieldChange(event.target.value as TField)}
          className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm"
        >
          {fields.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-primary">
        Ordem
        <select
          value={order}
          onChange={(event) => onOrderChange(event.target.value as SortOrder)}
          className="mt-1 w-full rounded border border-border-subtle bg-background px-3 py-2 text-sm"
        >
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </select>
      </label>
    </fieldset>
  )
}
