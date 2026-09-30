export type SortOrder = 'asc' | 'desc'

export type SortOption<TValue extends string> = {
  value: TValue
  label: string
}
